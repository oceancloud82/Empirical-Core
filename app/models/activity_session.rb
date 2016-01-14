class ActivitySession < ActiveRecord::Base

  include Uid

  belongs_to :classroom_activity
  belongs_to :activity
  has_one :unit, through: :classroom_activity
  has_many :concept_results
  has_many :concepts, -> { uniq }, through: :concept_results

  accepts_nested_attributes_for :concept_results

  ownable :user
  after_save { if user.present? then user.touch end}


  before_create :set_state
  before_save   :set_completed_at
  before_save   :set_activity_id

  after_save    :determine_if_final_score


  around_save   :trigger_events

  # FIXME: do we need the below? if we omit it, may make things faster
  default_scope -> { joins(:activity) }
  default_scope { where(visible: true)}

  scope :completed,  -> { where('completed_at is not null') }
  scope :incomplete, -> { where('completed_at is null').where('is_retry = false') }
  scope :started_or_better, -> { where("state != 'unstarted'") }

  scope :current_session, -> {
    complete_session   = completed.first
    incomplete_session = incomplete.first
    (complete_session || incomplete_session)
  }

  RESULTS_PER_PAGE = 25

  def self.paginate(current_page, per_page)
    offset = (current_page.to_i - 1) * per_page
    limit(per_page).offset(offset)
  end

  def self.with_best_scores
    where(is_final_score: true)
  end

  def self.by_teacher(teacher)
    self.joins(user: :teacher).where(teachers_users: {id: teacher.id})
  end

  def self.with_filters(query, filters)
    if filters[:classroom_id].present?
      query = query.where("classrooms.id = ?", filters[:classroom_id])
    end

    if filters[:student_id].present?
      query = query.where("activity_sessions.user_id = ?", filters[:student_id])
    end

    if filters[:unit_id].present?
      query = query.joins(:classroom_activity).where("classroom_activities.unit_id = ?", filters[:unit_id])
    end

    if filters[:section_id].present?
      query = query.joins(activity: :topic).where('topics.section_id IN (?)', filters[:section_id])
    end

    if filters[:topic_id].present?
      query = query.joins(:activity).where('activities.topic_id IN (?)', filters[:topic_id])
    end

    query
  end

  def determine_if_final_score
    return true if (self.percentage.nil? or self.state != 'finished')
    a = ActivitySession.where(classroom_activity: self.classroom_activity, user: self.user, is_final_score: true)
                       .where.not(id: self.id).first
    if a.nil?
      self.update_columns is_final_score: true
    elsif self.percentage > a.percentage
      self.update_columns is_final_score: true
      a.update_columns is_final_score: false
    end
    # return true otherwise save will be prevented
    return true
  end

  def activity
    super || classroom_activity.activity
  end

  def classroom
    unit.classroom
  end

  def display_due_date_or_completed_at_date
    if self.completed_at.present?
      "Completed #{self.completed_at.strftime('%A %B, %d, %Y')}"
    elsif (self.classroom_activity.present? and self.classroom_activity.due_date.present?)
      "Due #{self.classroom_activity.due_date.strftime('%A %B, %d, %Y')}"
    else
      ""
    end
  end

  def percentile
    case percentage
    when 0.75..1.0
      1.0
    when 0.5..0.75
      0.75
    when 0.0..0.5
      0.5
    else
      0.0
    end
  end

  def percentage_as_percent_prefixed_by_scored
    if percentage.nil?
      "Not completed yet"
    else
      x = (percentage*100).round.to_s + '%'
      "Scored #{x}"
    end
  end

  def percentage_with_zero_if_nil
    ((percentage || 0)*100).round
  end

  def percentage_as_decimal
    percentage.try(:round, 2)
  end

  def percentage_as_percent
    if percentage.nil?
      "no percentage"
    else
      (percentage*100).round.to_s + '%'
    end
  end

  def score
    (percentage*100).round
  end

  def start
    return if state != 'unstarted'
    self.started_at ||= Time.current
    self.state = 'started'
  end

  def data=(input)
    data_will_change!
    self['data'] = self.data.to_h.update(input.except("activity_session"))
  end

  def activity_uid= uid
    self.activity_id = Activity.find_by_uid!(uid).id
  end

  def activity_uid
    activity.try(:uid)
  end

  def completed?
    completed_at.present?
  end

  def grade
    percentage
  end

  def hide
    binding.pry
    visible = false
    save(validate: false)
  end

  alias owner user

  # TODO legacy fix
  def anonymous= anonymous
    self.temporary = anonymous
  end

  def anonymous
    temporary
  end

  def owned_by? user
    return true if temporary
    super
  end

  private

  def self.search_sort_sql(sort)
    if sort.blank? or sort[:field].blank?
      sort = {
        field: 'completed_at',
        direction: 'desc'
      }
    end

    if sort[:direction] == 'desc'
      order = 'desc'
    else
      order = 'asc'
    end

    # The matching names for this case statement match those returned by
    # the progress reports ActivitySessionSerializer and used as
    # column definitions in the corresponding React component.
    case sort[:field]
    when 'activity_classification_name'
      "activity_classifications.name #{order}, users.name #{order}"
    when 'student_name'
      "users.name #{order}"
    when 'completed_at'
      "activity_sessions.completed_at #{order}"
    when 'activity_name'
      "activities.name #{order}"
    when 'percentage'
      "activity_sessions.percentage #{order}"
    when 'standard'
      "topics.name #{order}"
    end
  end

  def trigger_events
    should_async = state_changed?

    yield # http://stackoverflow.com/questions/4998553/rails-around-callbacks

    return unless should_async

    if state == 'finished'
      FinishActivityWorker.perform_async(self.uid)
    end
  end

  def set_state
    self.state ||= 'unstarted'
    self.data ||= Hash.new
  end

  def set_activity_id
    self.activity_id = classroom_activity.try(:activity_id) if activity_id.nil?
  end

  def set_completed_at
    return true if state != 'finished'
    self.completed_at ||= Time.current
  end

end
