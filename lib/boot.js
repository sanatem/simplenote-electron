import React from 'react';
import App from './app';
import getConfig from '../get-config';
import sanaterium from './sanaterium';
import store from './state';
import {
  reset as resetAuth,
  setAuthorized,
  setInvalidCredentials,
  setLoginError,
  setPending as setPendingAuth,
} from './state/auth/actions';
import { setAccountName } from './state/settings/actions';
import analytics from './analytics';

import { parse } from 'cookie';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { some } from 'lodash';

import { content as welcomeMessage } from './welcome-message';

import appState from './flux/app-state';

const { newNote } = appState.actionCreators;

const config = getConfig();

const cookie = parse(document.cookie);
const appProvider = 'simplenote.com'; //para crear el user

require('../scss/app.scss');

const token = cookie.token || localStorage.access_token;
const appId = config.app_id;

// Redirect to web sign in if running on App Engine
if (!token && config.is_app_engine) {
  window.location = 'https://app.simplenote.com/signin';
}

// Our client which connects with the ZAPNOTE API
const client = sanaterium();

const app = document.createElement('div');

document.body.appendChild(app);

let props = {
  client: client,
  noteBucket: client,
  tagBucket: client,
  onAuthenticate: (username, password) => {
    if (!(username && password)) {
      return;
    }

    store.dispatch(setPendingAuth());
    client.auth.emailSignIn({
      email: username,
      password: password,
    }).then(function(payload) {
      var user = payload.data
      //client.setUser(user);
      // We save in the state the logged user.
      store.dispatch(setAccountName(user.email));
      store.dispatch(setAuthorized());
      localStorage.access_token = client.auth.retrieveData('authHeaders')['access-token'];
    })
    .fail(function(resp) {
      store.dispatch(setInvalidCredentials());
    });
  },

  onCreateUser: (username, password) => {
    if (!(username && password)) {
      return;
    }

    store.dispatch(setPendingAuth());
    client.auth.emailSignUp({
      email: username,
      password: password,
      password_confirmation: password
    }).then(function(payload) {
      var user = payload.data
      //client.setUser(user);
      // We save in the state the logged user.
      store.dispatch(setAccountName(user.name));
      store.dispatch(setAuthorized());
      localStorage.access_token = "asd";
      // analytics.tracks.recordEvent('user_signed_in');
    })
    // TODO: see if we can make this work
    // .then(() => {
    //   store.dispatch(
    //     newNote({
    //       noteBucket: client,
    //       content: welcomeMessage,
    //     })
    //   )
    // })
    .fail(function(resp) {
      store.dispatch(setLoginError());
    });
  },
  onSignOut: () => {
    delete localStorage.access_token;
    store.dispatch(setAccountName(null));
    client.auth.signOut();

    store.dispatch(resetAuth());

    window.location = '/';

    if (config.signout) {
      config.signout(function() {
        window.location = '/';
      });
    }
    analytics.tracks.recordEvent('user_signed_out');
  },
};

//This render the ENTIRE APP.

render(
  React.createElement(Provider, { store }, React.createElement(App, props)),
  app
);
