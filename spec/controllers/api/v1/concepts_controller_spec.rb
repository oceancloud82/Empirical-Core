require 'rails_helper'

describe Api::V1::ConceptsController, type: :controller do

  context 'POST #create' do
    let!(:user) { FactoryGirl.create(:staff) }
    let!(:token) { double :acceptable? => true, resource_owner_id: user.id }
    let!(:concept_name) { 'Concept1' }
    let!(:parent_concept) { FactoryGirl.create(:concept) }

    def subject
      post :create, {name: concept_name, parent_uid: parent_concept.uid}
    end

    it_behaves_like 'protected endpoint'

    context 'default behavior' do
      let(:parsed_body) { JSON.parse(response.body) }

      before do
        allow(controller).to receive(:doorkeeper_token) {token}
        subject
      end

      it 'responds with 200' do
        expect(response.status).to eq(200)
      end

      it 'responds with correct keys' do
        expect(parsed_body['concept'].keys).to match_array(%w(uid name))
      end

      it 'responds with correct values' do
        expect(parsed_body['concept']['name']).to eq(concept_name)
        expect(parsed_body['concept']['uid']).to_not be_nil
      end
    end
  end

  context 'GET #index' do
    let!(:concept1) { FactoryGirl.create(:concept, name: 'Articles') }
    let!(:concept2) { FactoryGirl.create(:concept, name: 'The', parent: concept1) }
    let(:parsed_body) { JSON.parse(response.body) }

    def subject
      get :index
    end

    before do
      subject
    end

    it 'returns all concepts' do
      expect(parsed_body['concepts'].length).to eq(2)
    end
  end
end
