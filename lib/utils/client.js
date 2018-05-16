import axios from "axios";
import {ZAPNOTE_API} from "../config/environment";

//axios.defaults.headers.common['Authorization'] = 'Token token='+AUTH_TOKEN;
//axios.defaults.headers.get['Content-Type'] = 'application/json';

var client;

export default {

  init: function(payload) {
    client = axios.create({
      headers: payload
    })
  },

  getRequest: function(url){
    return client.get(ZAPNOTE_API+url)
      .then(response => {
        return response.data
    });
  },

  postRequest: function(url){
    return client.post(ZAPNOTE_API+url)
      .then(response => {
        return response.data
      });
  },

  putRequest: function(url, options){
    return client.put(ZAPNOTE_API+url, options)
      .then(response => {
        return response.data
    });
  },

  deleteRequest: function(url, options){
    return client.delete(ZAPNOTE_API+url, options)
      .then(response => {
        return response.data
    });
  },

  getSortedNotes: function(sorted){
    var order = ''
    if(sorted === 'modificationDate') {
      order = 'updated_at desc';
    }
    else if(sorted === 'creationDate') {
      order = 'created_at desc';
    }
    else {
      order = sorted;
    }

    return client.get(ZAPNOTE_API+'/notes.json?order='+order)
      .then(response => {
        return response.data
    });
  },

  // Total of Notes
  getNotes: function(){
    return this.getRequest('/notes.json')
  },

  // Creates a new note
  newNote: function(){
    return this.postRequest('/notes.json')
  },

  // Creates a new note
  updateNote: function(noteId, content){
    return this.putRequest('/notes/'+noteId+'.json', { content: content })
  },

  // Gets the note info from server
  getNote: function(noteId){
    return this.getRequest('/notes/'+noteId+'.json')
  },

  // Move note to trash
  trashNote: function(noteId){
    return this.putRequest('/notes/'+noteId+'.json', { trashed: true })
  },

  //Update note tags
  updateNoteTags: function(noteId, tags){
    return this.putRequest('/notes/'+noteId+'.json', { tags: JSON.stringify(tags) })
  },

  //GET tags
  getTags: function(){
    return this.getRequest('/tags.json')
  },

  //Delete note forever
  deleteNote: function(noteId){
    return this.deleteRequest('/notes/'+noteId+'.json')
  },

  //Restore the note
  restoreNote: function(noteId){
    return this.putRequest('/notes/'+noteId+'.json', { trashed: false })
  },

  //Trash tag
  trashTag: function(tagId){
    return this.deleteRequest('/tags/'+tagId+'.json')
  },
  // Empty trash
  emptyTrash: function(){
    return this.deleteRequest('/empty_trash.json')
  }

}

