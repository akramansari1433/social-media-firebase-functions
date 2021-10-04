const express = require("express");
const { auth, config } = require("../utils/firebase.js");
const { db, admin } = require("../utils/admin.js");
const { FBAuth } = require("../utils/auth.js");

const router = express.Router();

//sign up
router.post("/signup", (req, res) => {
   const newUser = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      handle: req.body.handle,
   };

   if (newUser.password !== newUser.confirmPassword) {
      return res.status(400).json({ password: "Password must be same." });
   }

   const noImg = "no-img.png";
   let token, userId;
   //TODO validate
   db.doc(`/users/${newUser.handle}`)
      .get()
      .then((doc) => {
         if (doc.exists) {
            return res
               .status(400)
               .json({ handle: "This handle is already taken." });
         } else {
            return auth.createUserWithEmailAndPassword(
               newUser.email,
               newUser.password
            );
         }
      })
      .then((data) => {
         userId = data.user.uid;
         return data.user.getIdToken();
      })
      .then((idtoken) => {
         token = idtoken;
         const userCredentials = {
            handle: newUser.handle,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
            userId,
         };
         return db.doc(`/users/${newUser.handle}`).set(userCredentials);
      })
      .then(() => {
         res.status(201).json({ token });
      })
      .catch((err) => {
         console.log(err);
         if (err.code === "auth/email-already-in-use") {
            return res.status(400).json({ email: "Email is already in use." });
         } else {
            return res
               .status(500)
               .json({ general: "Something went wrong, please try again." });
         }
      });
});

//login
router.post("/login", (req, res) => {
   const user = {
      email: req.body.email,
      password: req.body.password,
   };
   auth
      .signInWithEmailAndPassword(user.email, user.password)
      .then((data) => {
         return data.user.getIdToken();
      })
      .then((token) => {
         return res.json({ token });
      })
      .catch((err) => {
         console.log(err);
         return res
            .status(403)
            .json({ general: "Wrong credentials, please try again." });
      });
});

//upload image
router.post("/image", FBAuth, (req, res) => {
   const BusBoy = require("busboy");
   const path = require("path");
   const os = require("os");
   const fs = require("fs");

   let imageFileName;
   let imageToBeUploaded = {};

   const busboy = new BusBoy({ headers: req.headers });
   busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
         return res.status(400).json({ error: "Wrong file type submitted." });
      }

      const imageExtension =
         filename.split(".")[filename.split(".").length - 1];
      imageFileName = `${Math.round(
         Math.random() * 1000000
      )}.${imageExtension}`;
      const filepath = path.join(os.tmpdir(), imageFileName);
      imageToBeUploaded = { filepath, mimetype };
      file.pipe(fs.createWriteStream(filepath));
   });
   busboy.on("finish", () => {
      admin
         .storage()
         .bucket()
         .upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
               contentType: imageToBeUploaded.mimetype,
            },
         })
         .then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
         })
         .then(() => {
            return res.json({ meassge: "Image uploaded successfully!" });
         })
         .catch((err) => {
            console.log(err);
            return res.status(500).json({ error: err.code });
         });
   });
   busboy.end(req.rawBody);
});

//add user details
router.post("/addUserDetails", FBAuth, (req, res) => {
   let userDetails = req.body;
   db.doc(`/users/${req.user.handle}`)
      .update(userDetails)
      .then(() => {
         return res.json({ message: "Details added successfully!" });
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});

//get own user details
router.get("/getAuthenticatedUser", FBAuth, (req, res) => {
   let userData = {};
   db.doc(`/users/${req.user.handle}`)
      .get()
      .then((doc) => {
         if (doc.exists) {
            userData.credentials = doc.data();
            return db
               .collection("likes")
               .where("userHandle", "==", req.user.handle)
               .get();
         }
      })
      .then((data) => {
         userData.likes = [];
         data.forEach((doc) => {
            userData.likes.push(doc.data());
         });
         return db
            .collection("notifications")
            .where("recipient", "==", req.user.handle)
            .orderBy("createdAt", "desc")
            .limit(10)
            .get();
      })
      .then((data) => {
         userData.notifications = [];
         data.forEach((doc) => {
            userData.notifications.push({
               recipient: doc.data().recipient,
               sender: doc.data().sender,
               createdAt: doc.data().createdAt,
               postId: doc.data().postId,
               type: doc.data().type,
               read: doc.data().read,
               notificationId: doc.id,
            });
         });
         return res.json(userData);
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err.code });
      });
});

//get any user's details
router.get("/:handle", (req, res) => {
   let userData = {};
   db.doc(`/users/${req.params.handle}`)
      .get()
      .then((doc) => {
         if (doc.exists) {
            userData.user = doc.data();
            return db
               .collection("posts")
               .where("userHandle", "==", req.params.handle)
               .orderBy("createdAt", "desc")
               .get();
         } else {
            return res.status(404).json({ error: "User not found!" });
         }
      })
      .then((data) => {
         userData.posts = [];
         data.forEach((doc) => {
            userData.posts.push({
               ...doc.data(),
               postId: doc.id,
            });
         });
         return res.json(userData);
      })
      .catch((err) => {
         console.error(err);
         return res.status(500).json({ error: err.code });
      });
});

//mark notifications read
router.post("/notifications", FBAuth, (req, res) => {
   let batch = db.batch();
   req.body.forEach((notificationId) => {
      const notification = db.doc(`/notifications/${notificationId}`);
      batch.update(notification, { read: true });
   });
   batch
      .commit()
      .then(() => {
         return res.json({ message: "Notifications marked read!" });
      })
      .catch((err) => {
         console.error(err);
         return res.status(500).json({ error: err.code });
      });
});

module.exports = router;
