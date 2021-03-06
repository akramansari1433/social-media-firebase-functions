const express = require("express");
const { db } = require("../utils/admin.js");
const { FBAuth } = require("../utils/auth.js");

const router = express.Router();

//create new post
router.post("/", FBAuth, (req, res) => {
   const post = {
      body: req.body.body,
      userHandle: req.user.handle,
      userImage: req.user.imageUrl,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
   };
   db.collection("posts")
      .add(post)
      .then((doc) => {
         const resPost = post;
         resPost.postId = doc.id;
         res.json(resPost);
      })
      .catch((err) => console.log(err));
});

//get all posts
router.get("/all", (req, res) => {
   db.collection("posts")
      .orderBy("createdAt", "desc")
      .get()
      .then((data) => {
         let posts = [];
         data.forEach((doc) => {
            posts.push({
               postId: doc.id,
               ...doc.data(),
            });
         });
         return res.json(posts);
      })
      .catch((err) => console.log(err));
});

//get post
router.get("/:postId", (req, res) => {
   let postData = {};
   db.doc(`/posts/${req.params.postId}`)
      .get()
      .then((doc) => {
         if (!doc.exists) {
            return res.status(404).json({ error: "post not found" });
         }
         postData = doc.data();
         postData.postId = doc.id;
         return db
            .collection(`comments`)
            .orderBy("createdAt", "desc")
            .where("postId", "==", req.params.postId)
            .get();
      })
      .then((data) => {
         postData.comments = [];
         data.forEach((doc) => {
            postData.comments.push(doc.data());
         });
         return res.json(postData);
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});

//comment on post
router.post("/comment/:postId", FBAuth, (req, res) => {
   if (req.body.body.trim() === "") {
      return res.status(400).json({ comment: "Must not be empty" });
   }
   const newComment = {
      body: req.body.body,
      createdAt: new Date().toISOString(),
      postId: req.params.postId,
      userHandle: req.user.handle,
      userImage: req.user.imageUrl,
   };
   db.doc(`/posts/${req.params.postId}`)
      .get()
      .then((doc) => {
         if (!doc.exists) {
            return res.status(404).json({ error: "Post not found!" });
         }
         return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
      })
      .then(() => {
         return db.collection("comments").add(newComment);
      })
      .then(() => {
         return res.json(newComment);
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});

//like post
router.get("/like/:postId", FBAuth, (req, res) => {
   const likeDocument = db
      .collection("likes")
      .where("userHandle", "==", req.user.handle)
      .where("postId", "==", req.params.postId)
      .limit(1);

   const postDocument = db.doc(`/posts/${req.params.postId}`);
   let postData = {};
   postDocument
      .get()
      .then((doc) => {
         if (doc.exists) {
            postData = doc.data();
            postData.postId = doc.id;
            return likeDocument.get();
         } else {
            return res.status(404).json({ error: "Post not found!" });
         }
      })
      .then((data) => {
         if (data.empty) {
            return db
               .collection("likes")
               .add({
                  postId: req.params.postId,
                  userHandle: req.user.handle,
               })
               .then(() => {
                  postData.likeCount++;
                  return postDocument.update({ likeCount: postData.likeCount });
               })
               .then(() => {
                  return res.json(postData);
               });
         } else {
            return res.status(400).json({ error: "Post already liked!" });
         }
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});

//unlike post
router.get("/unlike/:postId", FBAuth, (req, res) => {
   const likeDocument = db
      .collection("likes")
      .where("userHandle", "==", req.user.handle)
      .where("postId", "==", req.params.postId)
      .limit(1);

   const postDocument = db.doc(`/posts/${req.params.postId}`);
   let postData = {};
   postDocument
      .get()
      .then((doc) => {
         if (doc.exists) {
            postData = doc.data();
            postData.postId = doc.id;
            return likeDocument.get();
         } else {
            return res.status(404).json({ error: "Post not found!" });
         }
      })
      .then((data) => {
         if (data.empty) {
            return res.status(400).json({ error: "Post not liked!" });
         } else {
            return db
               .doc(`/likes/${data.docs[0].id}`)
               .delete()
               .then(() => {
                  postData.likeCount--;
                  return postDocument.update({ likeCount: postData.likeCount });
               })
               .then(() => {
                  res.json(postData);
               });
         }
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});

//delet post
router.delete("/:postId", FBAuth, (req, res) => {
   const document = db.doc(`/posts/${req.params.postId}`);
   document
      .get()
      .then((doc) => {
         if (!doc.exists) {
            return res.status(404).json({ error: "Post not found" });
         }
         if (doc.data().userHandle !== req.user.handle) {
            return res.status(403).json({ error: "Unauthorized" });
         } else {
            return document.delete();
         }
      })
      .then(() => {
         res.json({ message: "Post deleted successfully" });
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});
module.exports = router;
