//= require ./../general_components/table/sortable_table/table_filter_mixin.js
//= require ./../general_components/table/sortable_table/table_sorting_mixin.js
EC.ProgressReport = React.createClass({
  mixins: [EC.TableFilterMixin, EC.TableSortingMixin],

  propTypes: {
    columnDefinitions: React.PropTypes.func.isRequired,
    filterTypes: React.PropTypes.array.isRequired,
    pagination: React.PropTypes.bool.isRequired,
    sourceUrl: React.PropTypes.string.isRequired,
    sortDefinitions: React.PropTypes.func.isRequired,
    jsonResultsKey: React.PropTypes.string.isRequired,
    onFetchSuccess: React.PropTypes.func, // Optional
    exportCsv: React.PropTypes.string
  },

  getDefaultProps: function() {
    return {
      maxPageNumber: 4
    };
  },

  getInitialState: function() {
    return {
      currentPage: 1,
      numPages: 1,

      loading: false,

      results: [],
      classroomFilters: [],
      studentFilters: [],
      unitFilters: [],
      teacher: {},

      selectedClassroom: {name: 'All Classrooms', value: ''},
      selectedStudent: {name: 'All Students', value: ''},
      selectedUnit: {name: 'All Units', value: ''}
    };
  },

  componentDidMount: function() {
    var sortDefinitions = this.props.sortDefinitions();
    this.defineSorting(sortDefinitions.config, sortDefinitions.default);
    this.fetchData();
  },


  // Get results with all filters, sorting
  getFilteredResults: function() {
    var allResults = this.state.results;
    return this.applySorting(allResults);
  },

  // Get results after pagination has been applied.
  getVisibleResults: function(filteredResults) {
    return filteredResults;
  },

  goToPage: function(page) {
    var newState = {
      currentPage: page
    };
    this.setState(newState, this.fetchData);
  },

  resetPagination: function(next) {
    this.setState({currentPage: 1}, next);
  },

  // Filter sessions based on the classroom ID.
  selectClassroom: function(classroom) {
    this.setState({selectedClassroom: classroom})
    this.filterByField('classroom_id', classroom.value, this.onFilterChange);
  },

  // Filter sessions based on the student ID
  selectStudent: function(student) {
    this.setState({selectedStudent: student})
    this.filterByField('student_id', student.value, this.onFilterChange);
  },

  // Filter sessions based on the unit ID
  selectUnit: function(unit) {
    this.setState({selectedUnit: unit})
    this.filterByField('unit_id', unit.value, this.onFilterChange);
  },

  onFilterChange: function() {
    if (this.props.pagination) {
      this.resetPagination(this.fetchData);
    } else {
      this.fetchData();
    }
  },

  requestParams: function() {
    var requestParams = _.extend(this.state.currentFilters, {});
    if (this.props.pagination) {
      requestParams = _.extend(requestParams, {page: this.state.currentPage});
    }
    requestParams['sort'] = this.state.currentSort;
    return requestParams;
  },

  fetchData: function() {
    this.setState({loading: true});
    $.get(this.props.sourceUrl, this.requestParams(), function onSuccess(data) {
      this.setState({
        numPages: data.page_count,
        loading: false,
        results: data[this.props.jsonResultsKey],
        teacher: data.teacher,
        classroomFilters: this.getFilterOptions(data.classrooms, 'name', 'id', 'All Classrooms'),
        studentFilters: this.getFilterOptions(data.students, 'name', 'id', 'All Students'),
        unitFilters: this.getFilterOptions(data.units, 'name', 'id', 'All Units')
      });
      if (this.props.onFetchSuccess) {
        this.props.onFetchSuccess(data);
      }
    }.bind(this)).fail(function error(error) {
      console.log('An error occurred while fetching data', error);
    });
  },

  // Depending upon whether or not pagination is implemented,
  // sort results client-side or fetch sorted data from server.
  handleSort: function() {
    var cb;
    if (this.props.pagination) {
      cb = this.fetchData;
    } else {
      cb = _.noop;
    }
    return _.bind(this.sortResults, this, cb);
  },

  render: function() {
    var pagination, csvExport, mainSection;
    var filteredResults = this.getFilteredResults();
    if (this.props.pagination) {
      pagination = <EC.Pagination maxPageNumber={this.props.maxPageNumber}
                                  selectPageNumber={this.goToPage}
                                  currentPage={this.state.currentPage}
                                  numberOfPages={this.state.numPages}  />;
    }
    var visibleResults = this.getVisibleResults(filteredResults);

    if (this.props.exportCsv) {
      csvExport = <EC.ExportCsv exportType={this.props.exportCsv}
                                reportUrl={this.props.sourceUrl}
                                filters={this.state.currentFilters}
                                teacher={this.state.teacher} />;
    }
    if (this.state.loading) {
      mainSection = <EC.LoadingIndicator />;
    } else {
      mainSection = <EC.SortableTable rows={visibleResults}
                                      columns={this.props.columnDefinitions()}
                                      sortHandler={this.handleSort()}
                                      currentSort={this.state.currentSort} />;
    }

    return (
      <div>
        <div className="row">
          <div className="col-md-8 header-section">
            {this.props.children}
          </div>
          <div className="col-md-3 col-md-offset-1">
            {csvExport}
            <EC.FaqLink />
          </div>
        </div>
        <EC.ProgressReportFilters classroomFilters={this.state.classroomFilters}
                                  studentFilters={this.state.studentFilters}
                                  unitFilters={this.state.unitFilters}
                                  selectClassroom={this.selectClassroom}
                                  selectedClassroom={this.state.selectedClassroom}
                                  selectStudent={this.selectStudent}
                                  selectedStudent={this.state.selectedStudent}
                                  selectUnit={this.selectUnit}
                                  selectedUnit={this.state.selectedUnit}
                                  filterTypes={this.props.filterTypes} />
        {mainSection}
        {pagination}
      </div>
    );
  }
});