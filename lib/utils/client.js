import axios from "axios";
import {ZAPNOTE_API} from "../config/environment";

//axios.defaults.headers.common['Authorization'] = 'Token token='+AUTH_TOKEN;
//axios.defaults.headers.get['Content-Type'] = 'application/json';

var client = axios.create({
  timeout: 1000,
  // headers: {'Authorization': 'Token token='+METAGAME_TOKEN }
});


export default {

  getRequest: function(url){
    return client.get(ZAPNOTE_API+url)
      .then(response => {
        return response.data
    });
  },

  //Total of Notes
  getNotes: function(){
    return this.getRequest('/notes.json')
  },

  //Example with params
  // getNoteInfo(param){
  //   return this.getRequest('/notes?email=' + param);
  // }

}

