/**
 * Sanaterium is the object which connect with zapnote_server using J-toker
 */

// Our imports
import {ZAPNOTE_API} from "../config/environment";
import $ from 'jquery';
export const Auth = require('j-toker');

export default function(token, config) {
  return new BrowserClient();
}

function BrowserClient(){
  this.auth = Auth;
  // We configure the j-Toker client
  this.auth.configure({
    apiUrl: ZAPNOTE_API
  });

}


BrowserClient.prototype.isAuthorized = function() {
  return !!this.auth.accessToken;
};

BrowserClient.prototype.setUser = function(user) {
  // todo, set the user access token and have the buckets reconnect
  this.auth.setAccessToken("asd");
  this.emit('authorized');
};

BrowserClient.prototype.deauthorize = function() {
  this.auth.setAccessToken(null);
  this.emit('unauthorized');
  this.auth.disconnect();
  this.reset();
};
