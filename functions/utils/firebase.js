const firebase = require("firebase");

const config = {
   apiKey: "AIzaSyCrQTsnyj5zSrDgPj2oivTJPImgLmEcGBQ",
   authDomain: "social-media-a38ca.firebaseapp.com",
   projectId: "social-media-a38ca",
   storageBucket: "social-media-a38ca.appspot.com",
   messagingSenderId: "219361851230",
   appId: "1:219361851230:web:880c50f7f7ca468fa381cf",
   measurementId: "G-50ETJXRF7R",
};

const app = firebase.initializeApp(config);

const auth = app.auth();

module.exports = { auth, config };
