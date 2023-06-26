//jshint:es6
require("dotenv").config();

const Express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const _ = require("lodash");
const ejs = require("ejs");
const mongoose = require("mongoose");
const findOrCreate = require("mongoose-findorcreate");
const localMongoose = require("passport-local-mongoose");
const passport = require("passport");
const session = require("express-session");
let hidden = false;
const app = Express();
/// Wrap everything in try and catch //// DONE
/// rework the registration page /// IN PROGRESS
/// annotate YOUR DAMN CODE (almost done)
/// refactor code (YOU MUST DO THIS!) DONE
/// make indexes off the beginning of the startup //// DONE
/// STYLE THE WEBSITE //// MOSTLY DONE
app.use(Express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb://127.0.0.1:27017/dndDB", { useNewUrlParser: true, useUnifiedTopology: true });
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    isAdmin: Boolean,
    knowledgePoints: Number,

});

// post schema, may have a few extra props that don't make sense right now, but will in the future.
const postSchema = new mongoose.Schema({
    title:
    {
        type: String,
        index: true,
    },
    description: String,
    isHidden: Boolean,
    owner: String,
    date: String,
    userHandle: String,
    genre: Array,
    cost: Number,
});
postSchema.index({ title: "text", description: "text", userHandle: "text" });
const listItems = ["DM", "Player", "PC", "NPCS", "Places", "History", "Inquiry"];


/// Need local mongoose AND passport for login and registration that is confidential
userSchema.plugin(localMongoose);
userSchema.plugin(findOrCreate);
postSchema.plugin(findOrCreate);
/// find or create is an NPM package not an actual function from mongoose.
const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema);


/// Initializing passport, making sure it's being used and such.
passport.use(User.createStrategy());
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // console.log(`id: ${id}`);
    User.findById(id)
        .then((user) => {
            done(null, user);
        })
        .catch((error) => {
            console.log(`Error: ${error}`);
        });
});

/// home route. It's the registration page as there will probably be no news or anything of the sort, so being able to log in
/// quicker is just more efficient.
app.route("/")
    .get(function (req, res) {
        res.render("home");
    }).post(function (req, res) {

        try {
            /// creating the user
            const user = new User({
                username: req.body.username,
                password: req.body.password,

            });
            /// logging the user in
            req.login(user, function (err) {
                if (!err) {
                    /// authenticate the user with a cookie if success, if fail it redirects to the first page.
                    passport.authenticate("local", { failureRedirect: "/", failureMessage: true })(req, res, function () {
                        res.redirect("/something");
                    })
                }
                else {
                    res.redirect("/");
                }

            })

        }
        catch (err) {
            console.log(err);
        }

    });
/// "something" is the list pages, I named it that at first and now it's escalated to the point where I'd have to replace way too much code.
app.get("/something", function (req, res) {
    try {
        /// auth check
        if (req.isAuthenticated()) {
            /// then it finds all the posts
            Post.find({}).then(function (list) {
                let postList = [];
                list.forEach((cur) => {
                    /// checking to make sure its not hidden, and also checking to see if user is admin.
                    if (cur.isHidden && cur.owner != req.user.id && !req.user.isAdmin) {
                        return;
                    }
                    else if (cur.isHidden && cur.owner != req.user.id && req.user.isAdmin) {
                        postList.push(cur);

                    }
                    else {
                        postList.push(cur);
                    }
                });
                /// mongoose goes from first thing posted to last, so to sort by date I just reverse it.
                postList.reverse();
                /// passes over the list, rendering it on screen.
                res.render("list", { postList: postList })
            });
        }
        else {
            res.redirect("/");
        }
    }
    catch (err) {
        console.log(err);
    }



});
app.route("/create")
    .get(function (req, res) {
        try {
            if (req.isAuthenticated()) {
                /// renders create page, list item should actually be removed it seems irrelevant.
                res.render("create", { list: listItems });
            }
            else {
                res.redirect("/");
            }
        }
        catch (err) {
            console.log(err);
        }

    })
    .post(function (req, res) {
        try {
            if (req.isAuthenticated()) {
                /// roundabout way of checking to see if the HIDDEN checkbox is checked.
                let isHidden = false;
                if (req.body.hidden === "on") {
                    isHidden = true;
                }
                let indexList = [];
                /// makes a new date, adding it to the post.
                let date = new Date();
                let currentDate = date.toLocaleDateString();
                const post = new Post({
                    title: req.body.title,
                    description: req.body.text,
                    isHidden: isHidden,
                    owner: req.user.id,
                    date: currentDate,
                    userHandle: req.user.username,

                });
                /// saves the post, then redirects to the list.
                post.save();
                res.redirect("/something");
            }
            else {
                /// if not authenticated will return to login page.
                res.redirect("/");
            }
        }
        catch (err) {
            console.log(err);
        }

    });
app.route("/search").post(function (req, res) {
    try {
        let fullString = req.body.search;
        /// searching for something with the title, description or author equaling what has been typed.
        Post.find({ $text: { $search: fullString } }).then(function (err, user) {
            let postList = [];
            err.forEach((cur) => {
                if (cur.isHidden && cur.owner != req.user.id && !req.user.isAdmin) {
                    return;
                }
                else if (cur.isHidden && cur.owner != req.user.id && req.user.isAdmin) {
                    postList.push(cur);
                 }
                else {
                    postList.push(cur);
                }
            })
            postList.reverse();
            /// this has to be fixed. If it's null it'll just not populate the page.
            if (postList != null) {

                res.render("list", { postList: postList });
            }
            else {
                res.redirect("/");
            }
        })
    }
    catch (err) {
        console.log(err);
    }
});
app.post("/delete/:customURL", function (req, res) {
    try {
        /// deletes post, but only if the user is the owner or an admin.
        const custom = req.params.customURL;
        if (req.isAuthenticated()) {
            Post.findOne({ title: custom }).then(function (value) {

                if (value.owner == req.user.id || req.user.isAdmin) {
                    Post.findOneAndRemove({ title: custom }).then((done) => {

                    })
                }
            });
            res.redirect("/something");
        }
        else {
            res.redirect("/");
        }
    }
    catch (err) {
        console.log(err);
    }
});
app.post("/update/:customURL", function (req, res) {
    try {
        const custom = req.params.customURL;
        if (req.isAuthenticated()) {
            try {

                Post.updateOne({ title: custom }, { title: req.body.title }).then(function (done) {
                    console.log(done);
                })
                Post.updateOne({ title: custom }, { description: req.body.text }).then(function (done) {
                    console.log(done);
                })


                if (req.body.hidden === "on") {
                    Post.updateOne({ title: custom }, { isHidden: true }).then(function (done) {
                        console.log(done);
                    })
                }
                else {
                    Post.updateOne({ title: custom }, { isHidden: false }).then(function (done) {
                        console.log(done);
                    })
                }
                res.redirect("/something");
            }
            catch (err) {
                console.log(err);
            }
        }
    }
    catch (err) {
        console.log(err);
    }
})
app.get("/list", function (req, res) {
    try {
        if (req.isAuthenticated()) {
            res.render("list");
        }
        else {
            console.log("not logged in");
            res.redirect("/");
        }
    }
    catch (err) {
        console.log(err);
    }
});
app.route("/register")
    .get(function (req, res) {
        try {
            if (!req.isAuthenticated()) {
                res.render("register");
            }
        }
        catch (err) {
            console.log(err);
        }
    })
    .post(function (req, res) {
        try {
            const newUser = new User({
                username: req.body.username,

                isAdmin: false,
            });
            User.register(newUser, req.body.password, function (err) {
                
                if (!err) {
                    passport.authenticate("local", { failureRedirect: "/register" })(req, res, function () {
                        res.redirect("/something");
                    })
                }
                else {
                    res.redirect("/");
                }
            });
        }
        catch (err) {
            console.log(err);
        }
    });
app.post("/logout", function (req, res) {
    try {
        req.logout(function (err) {
            res.redirect("/");
            console.log(err);
        });
    }
    catch (err) {
        console.log(err);
    }
});
app.route("/something/:customURL")
    .post(function (req, res) {
        try {
            let custom = req.params.customURL;
            if (req.isAuthenticated()) {
                Post.findOne({ title: custom }).then(data => {
                    if (req.user.id === data.owner || req.user.isAdmin) {
                        res.render("update", { post: data });
                    }
                    else res.redirect("/something");
                })
            }
        }
        catch (err) {
            let custom = req.params.customURL;
            if (req.isAuthenticated()) {
                Post.findOne({ title: custom }).then(data => {
                    if (req.user.id === data.owner || req.user.isAdmin) {
                        res.render("update", { post: data });
                    }
                    else res.redirect("/something");
                })
            }
        }
    }).get(function (req, res) {
        try {
            const custom = req.params.customURL;
            Post.findOne({ title: custom }).then(function (value) {
                res.render("post", { title: value })
            })
        }
        catch (err) {
            console.log(err);
        }
    });
app.get("/bs", function (req, res) {
    res.render("test");
})
app.listen(3000, function (req, res) {
    console.log("listening on 3k");
});