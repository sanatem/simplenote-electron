import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import appState from './flux/app-state';
import reduxActions from './state/actions';
import selectors from './state/selectors';
import browserShell from './browser-shell';
import { ContextMenu, MenuItem, Separator } from './context-menu';
import * as Dialogs from './dialogs/index';
import exportNotes from './utils/export';
import exportToZip from './utils/export/to-zip';
import SimplenoteCompactLogo from './icons/simplenote-compact';
import NoteInfo from './note-info';
import NoteList from './note-list';
import NoteEditor from './note-editor';
import NavigationBar from './navigation-bar';
import Auth from './auth';
import analytics from './analytics';
import classNames from 'classnames';
import {
  compact,
  concat,
  flowRight,
  noop,
  get,
  has,
  isObject,
  map,
  matchesProperty,
  overEvery,
  pick,
  values,
} from 'lodash';

import * as settingsActions from './state/settings/actions';

import filterNotes from './utils/filter-notes';
import SearchBar from './search-bar';


import client from './utils/client'


// Electron-specific mocks
let ipc = getIpc();
let fs = null;

var tries = 0;

function getIpc() {
  try {
    return __non_webpack_require__('electron').ipcRenderer; // eslint-disable-line no-undef
  } catch (e) {
    return {
      on: noop,
      removeListener: noop,
      send: noop,
    };
  }
}

const mapStateToProps = state => ({
  ...state,
  authIsPending: selectors.auth.authIsPending(state),
  isAuthorized: selectors.auth.isAuthorized(state),
});

function mapDispatchToProps(dispatch, { noteBucket }) {
  const actionCreators = Object.assign({}, appState.actionCreators);

  const thenReloadNotes = action => a => {
    dispatch(action(a));
    // Client Get sorted notes
    client.getSortedNotes(a).then(data =>{
      dispatch(actionCreators.loadNotes({ notes: data }));
    });
  };

  return {
    actions: bindActionCreators(actionCreators, dispatch),
    ...bindActionCreators(
      pick(settingsActions, [
        'activateTheme',
        'decreaseFontSize',
        'increaseFontSize',
        'resetFontSize',
        'setNoteDisplay',
        'setMarkdown',
        'setAccountName',
      ]),
      dispatch
    ),
    setSortType: thenReloadNotes(settingsActions.setSortType),
    toggleSortOrder: thenReloadNotes(settingsActions.toggleSortOrder),

    openTagList: () => dispatch(actionCreators.toggleNavigation()),
    resetAuth: () => dispatch(reduxActions.auth.reset()),
    setAuthorized: () => dispatch(reduxActions.auth.setAuthorized()),
    setSearchFocus: () =>
      dispatch(actionCreators.setSearchFocus({ searchFocus: true })),
  };
}

const isElectron = (() => {
  // https://github.com/atom/electron/issues/2288
  const foundElectron = has(window, 'process.type');

  if (foundElectron) {
    fs = __non_webpack_require__('fs'); // eslint-disable-line no-undef
  }

  return () => foundElectron;
})();

const isElectronMac = () =>
  matchesProperty('process.platform', 'darwin')(window);

export const App = connect(mapStateToProps, mapDispatchToProps)(
  class extends Component {
    static propTypes = {
      actions: PropTypes.object.isRequired,
      appState: PropTypes.object.isRequired,
      settings: PropTypes.object.isRequired,

      client: PropTypes.object.isRequired,
      noteBucket: PropTypes.object.isRequired,
      tagBucket: PropTypes.object.isRequired,
      onAuthenticate: PropTypes.func.isRequired,
      onCreateUser: PropTypes.func.isRequired,
      onSignOut: PropTypes.func.isRequired,
    };

    static defaultProps = {
      onAuthenticate: () => {},
      onCreateUser: () => {},
      onSignOut: () => {},
    };

    componentWillMount() {
      client.init(this.props.client.auth.retrieveData('authHeaders'));

      if (isElectron()) {
        this.initializeElectron();
      }

      this.onAuthChanged();
    }

    componentDidMount() {
      ipc.on('appCommand', this.onAppCommand);
      ipc.send('settingsUpdate', this.props.settings);

      // Checks if it is logged in and then reload the notes.
      this.checkAuthorized();

      this.toggleShortcuts(true);

      analytics.tracks.recordEvent('application_opened');
    }

    componentWillUnmount() {
      this.toggleShortcuts(false);

      ipc.removeListener('appCommand', this.onAppCommand);
    }

    componentDidUpdate(prevProps) {
      if (this.props.settings !== prevProps.settings) {
        ipc.send('settingsUpdate', this.props.settings);
      }

      // if (tries < 50) {
      //   client.init(this.props.client.auth.retrieveData('authHeaders'));
      //   this.onNotesIndex();
      //   tries++;
      // }
    }

    handleShortcut = event => {
      const { ctrlKey, key, metaKey } = event;

      const cmdOrCtrl = ctrlKey || metaKey;

      // open tag list
      if (cmdOrCtrl && 'T' === key && !this.state.showNavigation) {
        this.props.openTagList();

        event.stopPropagation();
        event.preventDefault();
        return false;
      }

      // focus search field
      if (cmdOrCtrl && 'F' === key) {
        this.props.setSearchFocus();

        event.stopPropagation();
        event.preventDefault();
        return false;
      }

      return true;
    };

    onAppCommand = (event, command) => {
      if ('exportZipArchive' === get(command, 'action')) {
        return exportNotes()
          .then(exportToZip)
          .then(zip =>
            zip.generateAsync({
              compression: 'DEFLATE',
              platform: get(window, 'process.platform', 'DOS'),
              type: 'base64',
            })
          )
          .then(blob => fs.writeFile(command.filename, blob, 'base64'))
          .catch(console.log); // eslint-disable-line no-console
      }

      const canRun = overEvery(
        isObject,
        o => o.action !== null,
        o => has(this.props.actions, o.action) || has(this.props, o.action)
      );

      if (canRun(command)) {
        // newNote expects a bucket to be passed in, but the action method itself wouldn't do that
        if (command.action === 'newNote') {
          const actions = this.props.actions;

          client.newNote().then(data =>{
            client.getNotes().then(res =>{
              const notes = res;
              // Client New Note
              actions.newNote({ note: data, notes: notes });
            });
          });

          analytics.tracks.recordEvent('list_note_created');
        } else if (has(this.props, command.action)) {
          const { action, ...args } = command;

          this.props[action](...values(args));
        } else {
          this.props.actions[command.action](command);
        }
      }
    };

    checkAuthorized = () => {
      if (this.props.isAuthorized === true){
        client.init(this.props.client.auth.retrieveData('authHeaders'));
        this.onNotesIndex();
        this.onTagsIndex();
        return;
      }
      else{
        setTimeout(this.checkAuthorized, 350);
      }
    }

    // Checks if the user is logged in.
    onAuthChanged = () => {
      const {
        actions,
        appState: { accountName },
        client,
        resetAuth,
        setAuthorized,
      } = this.props;

      actions.authChanged();

      this.props.client.auth.validateToken()
      .then(data => { setAuthorized(); })
      .fail(data => {
          actions.closeNote();
          return resetAuth;
        });
    };

    onNotePrinted = () =>
      this.props.actions.setShouldPrintNote({ shouldPrint: false });

    // Get all notes
    onNotesIndex = () => {
      if (this.props.isAuthorized === true) {
        var actions = this.props.actions;
        // Client Get notes
        client.getNotes().then(data =>{
           actions.loadNotes({ notes: data });
        });
      }
    }

    onNoteRemoved = () => this.onNotesIndex();

    onNoteUpdate = (note) =>{
      var actions = this.props.actions;
      // Client Get notes
      client.getNotes().then(res =>{
         var notes = res;
          actions.noteUpdated({
            noteId: note.id,
            note,
            notes
          });
      });

    }

    onTagsIndex = () => {
      const actions = this.props.actions;
      client.getTags().then(data => { actions.loadTags({ tags: data }) });
    }

    initializeElectron = () => {
      const remote = __non_webpack_require__('electron').remote; // eslint-disable-line no-undef

      this.setState({
        electron: {
          currentWindow: remote.getCurrentWindow(),
          Menu: remote.Menu,
        },
      });
    };

    onSetEditorMode = mode => this.props.actions.setEditorMode({ mode });

    onUpdateContent = (note, content) => {
      const actions = this.props.actions;
      // Update note in server
      client.updateNote(note.id, content).then( data => {
        actions.updateNoteContent({
          data,
          content,
        });
        // This updates the note title in real time.
        this.onNoteUpdate(data);
      });
    }

    onUpdateNoteTags = (note, tags) => {
      const actions = this.props.actions;
      // Update the tags in the server.
      client.updateNoteTags(note.id, tags).then( data => {
        actions.updateNoteTags({ note, tags });
        this.onTagsIndex();
      });
    }

    onTrashNote = note => {
      const previousIndex = this.getPreviousNoteIndex(note);
      const actions = this.props.actions;
      // Delete note on server

      client.trashNote(note.id).then( data => {
        client.getNotes().then(data => {
          var notes = data;

          actions.trashNote({
            note,
            notes,
            previousIndex,
          });

        });

      });

      analytics.tracks.recordEvent('editor_note_deleted');
    };

    // gets the index of the note located before the currently selected one
    getPreviousNoteIndex = note => {
      const filteredNotes = filterNotes(this.props.appState);

      const noteIndex = function(filteredNote) {
        return note.id === filteredNote.id;
      };

      return Math.max(filteredNotes.findIndex(noteIndex) - 1, 0);
    };

    onRestoreNote = note => {
      const previousIndex = this.getPreviousNoteIndex(note);
      const actions = this.props.actions;
      client.restoreNote(note.id).then(data => {
        client.getNotes().then( notes => {
          actions.restoreNote({
            note,
            notes,
            previousIndex
          });
        });
      });
      analytics.tracks.recordEvent('editor_note_restored');
    };

    onDeleteNoteForever = note => {
      const previousIndex = this.getPreviousNoteIndex(note);
      const actions = this.props.actions;
      client.deleteNote(note.id).then(data => {
        client.getNotes().then( notes => {
          actions.deleteNoteForever({
            note,
            notes,
            previousIndex,
          });
        });
      });

    };

    onShareNote = note =>
      this.props.actions.showDialog({
        dialog: {
          type: 'Share',
          modal: true,
        },
        params: { note },
      });

    onRevisions = note => {
      var actions = this.props.actions

      actions.noteRevisions({ note: note });
      analytics.tracks.recordEvent('editor_versions_accessed');
    };

    toggleShortcuts = doEnable => {
      if (doEnable) {
        window.addEventListener('keydown', this.handleShortcut, true);
      } else {
        window.removeEventListener('keydown', this.handleShortcut, true);
      }
    };

    render() {
      const {
        appState: state,
        authIsPending,
        isAuthorized,
        isSmallScreen,
        noteBucket,
        settings,
        tagBucket,
      } = this.props;
      const electron = get(this.state, 'electron');
      const isMacApp = isElectronMac();
      const filteredNotes = filterNotes(state);
      const hasNotes = filteredNotes.length > 0;

      const noteIndex = Math.max(state.previousIndex, 0);
      const selectedNote =
        isSmallScreen || state.note ? state.note : filteredNotes[noteIndex];

      const appClasses = classNames('app', `theme-${settings.theme}`, {
        'touch-enabled': 'ontouchstart' in document.body,
      });

      const mainClasses = classNames('simplenote-app', {
        'note-open': selectedNote,
        'note-info-open': state.showNoteInfo,
        'navigation-open': state.showNavigation,
        'is-electron': isElectron(),
        'is-macos': isMacApp,
      });

      return (
        <div className={appClasses}>
          {isElectron() && (
            <ContextMenu Menu={electron.Menu} window={electron.currentWindow}>
              <MenuItem label="Undo" role="undo" />
              <MenuItem label="Redo" role="redo" />
              <Separator />
              <MenuItem label="Cut" role="cut" />
              <MenuItem label="Copy" role="copy" />
              <MenuItem label="Paste" role="paste" />
              <MenuItem label="Select All" role="selectall" />
            </ContextMenu>
          )}
          {isAuthorized ? (
            <div className={mainClasses}>
              {state.showNavigation && (
                <NavigationBar noteBucket={noteBucket} tagBucket={tagBucket} sanaterium={this.props.client} />
              )}
              <div className="source-list theme-color-bg theme-color-fg">
                <SearchBar noteBucket={noteBucket} sanaterium={this.props.client} />
                {hasNotes ? (
                  <NoteList noteBucket={noteBucket} />
                ) : (
                  <div className="placeholder-note-list">
                    <span>No Notes</span>
                  </div>
                )}
              </div>
              {selectedNote &&
                hasNotes && (
                  <NoteEditor
                    allTags={state.tags}
                    editorMode={state.editorMode}
                    filter={state.filter}
                    note={selectedNote}
                    revisions={state.revisions}
                    onSetEditorMode={this.onSetEditorMode}
                    onUpdateContent={this.onUpdateContent}
                    onUpdateNoteTags={this.onUpdateNoteTags}
                    onTrashNote={this.onTrashNote}
                    onRestoreNote={this.onRestoreNote}
                    onShareNote={this.onShareNote}
                    onDeleteNoteForever={this.onDeleteNoteForever}
                    onRevisions={this.onRevisions}
                    onCloseNote={() => this.props.actions.closeNote()}
                    onNoteInfo={() => this.props.actions.toggleNoteInfo()}
                    shouldPrint={state.shouldPrint}
                    onNotePrinted={this.onNotePrinted}
                  />
                )}
              {!hasNotes && (
                <div className="placeholder-note-detail theme-color-border">
                  <div className="placeholder-note-toolbar theme-color-border" />
                  <div className="placeholder-note-editor">
                    <SimplenoteCompactLogo />
                  </div>
                </div>
              )}
              {state.showNoteInfo && <NoteInfo noteBucket={noteBucket} />}
            </div>
          ) : (
            <Auth
              authPending={authIsPending}
              isAuthenticated={isAuthorized}
              onAuthenticate={this.props.onAuthenticate}
              onCreateUser={this.props.onCreateUser}
              isMacApp={isMacApp}
            />
          )}
          {this.props.appState.dialogs.length > 0 && (
            <div className="dialogs">{this.renderDialogs()}</div>
          )}
        </div>
      );
    }

    renderDialogs = () => {
      const { dialogs } = this.props.appState;

      const makeDialog = (dialog, key) => [
        dialog.modal && (
          <div key="overlay" className="dialogs-overlay" onClick={null} />
        ),
        this.renderDialog(dialog, key),
      ];

      return flowRight(compact, concat, map)(dialogs, makeDialog);
    };

    renderDialog = ({ params, ...dialog }, key) => {
      const DialogComponent = Dialogs[dialog.type];

      if (DialogComponent === null) {
        throw new Error('Unknown dialog type.');
      }

      return (
        <DialogComponent
          isElectron={isElectron()}
          {...this.props}
          {...{ key, dialog, params }}
        />
      );
    };
  }
);

export default browserShell(App);
