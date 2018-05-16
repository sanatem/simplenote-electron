/**
 * External dependencies
 */
import React from 'react';
import { connect } from 'react-redux';

/**
 * Internal dependencies
 */
import appState from './flux/app-state';
import { tracks } from './analytics';
import NewNoteIcon from './icons/new-note';
import SearchField from './search-field';
import TagsIcon from './icons/tags';
import { withoutTags } from './utils/filter-notes';

import client from './utils/client'

const { newNote, search, toggleNavigation } = appState.actionCreators;
const { recordEvent } = tracks;

export const SearchBar = ({
  onNewNote,
  onToggleNavigation,
  query,
  showTrash,
}) => (
  <div className="search-bar theme-color-border">
    <button
      className="button button-borderless"
      onClick={onToggleNavigation}
      title="Tags"
    >
      <TagsIcon />
    </button>
    <SearchField />
    <button
      className="button button-borderless"
      disabled={showTrash}
      onClick={() => onNewNote(withoutTags(query))}
      title="New Note"
    >
      <NewNoteIcon />
    </button>
  </div>
);

const mapStateToProps = ({ appState: state }) => ({
  query: state.filter,
  showTrash: state.showTrash,
});

const mapDispatchToProps = (dispatch, { noteBucket, sanaterium }) => ({
  onNewNote: content => {

      //const actions = this.props.actions;
      client.init(sanaterium.auth.retrieveData('authHeaders'));

      client.newNote().then(data =>{
        client.getNotes().then(res =>{
          const notes = res;
          // Client New Note
          dispatch(newNote({ note: data, notes: notes }));
        });
      });

    dispatch(search({ filter: '' }));
    //dispatch(newNote({ noteBucket, content }));
    recordEvent('list_note_created');
  },
  onToggleNavigation: () => dispatch(toggleNavigation()),
});

export default connect(mapStateToProps, mapDispatchToProps)(SearchBar);
