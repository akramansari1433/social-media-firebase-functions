const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const userRoute = require("./routes/user.js");
const postRoute = require("./routes/post.js");
const { db } = require("./utils/admin");

const app = express();
app.use(cors());

app.use("/user", userRoute);
app.use("/post", postRoute);

exports.api = functions.region("asia-south1").https.onRequest(app);

exports.createNotificationOnLike = functions
   .region("asia-south1")
   .firestore.document("likes/{id}")
   .onCreate((snapshot) => {
      return db
         .doc(`/posts/${snapshot.data().postId}`)
         .get()
         .then((doc) => {
            if (
               doc.exists &&
               doc.data().userHandle !== snapshot.data().userHandle
            ) {
               return db.doc(`/notifications/${snapshot.id}`).set({
                  createdAt: new Date().toISOString(),
                  recipient: doc.data().userHandle,
                  sender: snapshot.data().userHandle,
                  type: "like",
                  read: false,
                  postId: doc.id,
               });
            }
         })
         .catch((err) => {
            console.error(err);
         });
   });

exports.deleteNotificationOnUnLike = functions
   .region("asia-south1")
   .firestore.document("likes/{id}")
   .onDelete((snapshot) => {
      return db
         .doc(`/notifications/${snapshot.id}`)
         .delete()
         .catch((err) => {
            console.error(err);
         });
   });

exports.createNotificationOnComment = functions
   .region("asia-south1")
   .firestore.document("comments/{id}")
   .onCreate((snapshot) => {
      return db
         .doc(`/posts/${snapshot.data().postId}`)
         .get()
         .then((doc) => {
            if (
               doc.exists &&
               doc.data().userHandle !== snapshot.data().userHandle
            ) {
               return db.doc(`/notifications/${snapshot.id}`).set({
                  createdAt: new Date().toISOString(),
                  recipient: doc.data().userHandle,
                  sender: snapshot.data().userHandle,
                  type: "comment",
                  read: false,
                  postId: doc.id,
               });
            }
         })
         .catch((err) => {
            console.error(err);
            return;
         });
   });

exports.onUserImageChange = functions
   .region("asia-south1")
   .firestore.document("/users/{userId}")
   .onUpdate((change) => {
      if (change.before.data().imageUrl !== change.after.data().imageUrl) {
         let batch = db.batch();
         return db
            .collection("posts")
            .where("userHandle", "==", change.before.data().handle)
            .get()
            .then((data) => {
               data.forEach((doc) => {
                  const post = db.doc(`/posts/${doc.id}`);
                  batch.update(post, {
                     userImage: change.after.data().imageUrl,
                  });
               });
               return batch.commit();
            });
      } else return true;
   });

exports.onPostDelete = functions
   .region("asia-south1")
   .firestore.document("/posts/{postId}")
   .onDelete((snapshot, context) => {
      const postId = context.params.postId;
      let batch = db.batch();
      return db
         .collection("comments")
         .where("postId", "==", postId)
         .get()
         .then((data) => {
            data.forEach((doc) => {
               batch.delete(db.doc(`/comments/${doc.id}`));
            });
            return db.collection("likes").where("postId", "==", postId).get();
         })
         .then((data) => {
            data.forEach((doc) => {
               batch.delete(db.doc(`/likes/${doc.id}`));
            });
            return db
               .collection("notifications")
               .where("postId", "==", postId)
               .get();
         })
         .then((data) => {
            data.forEach((doc) => {
               batch.delete(db.doc(`/notifications/${doc.id}`));
            });
            return batch.commit();
         })
         .catch((err) => {
            console.error(err);
         });
   });
