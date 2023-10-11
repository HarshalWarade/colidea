
const usernames = new Set();

const nodemailer = require('nodemailer');
const fs = require('fs-extra');
const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

const multer = require('multer');

const BlogPost = require('./models/blogPostSchema');

app.use(express.urlencoded({extended: false}));
const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use(express.json());


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads");
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}${file.originalname}`);
    },
});



const upload = multer({storage});



dotenv.config({ path: 'config.env' });

const port = process.env.PORT;

const User = require('./models/userSchema');

require('./conn/conn')





app.use(express.static('assets'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));




app.get('/', async function(req, res) {
    return res.status(200).render('basic', {title: "Welcome | Colidea", link1: process.env.LINK1, link2: process.env.LINK2});
})
app.get('/createAccount', async function(req, res) {
    return res.status(200).render('createAccount', {title: "Create Account | Colidea", link1: process.env.LINK1, link2: process.env.LINK2});
})

const authenticate = require('./middleware/authenticate');

app.get('/check-username', (req, res) => {
    const username = req.query.username;
  
    if (usernames.has(username)) {
      res.json({ isTaken: true });
    } else {
      res.json({ isTaken: false });
    }
});
  
app.post('/generateAccount', async function(req, res) {
    const {firstName, lastName, username, phone, email, password, confirmPassword, dob, country} = req.body;

    try {
        const emailFound = await User.findOne({email:email})
        const usernameFound = await User.findOne({username: username});
        if(usernameFound) {
            return res.status(422).send(`${username} is already taken! Try something else!`);
        }
        if (password !== confirmPassword) {
            return res.status(422).json({ error: "Password and ConfirmPassword are not matching!" });
        }
      
        if (emailFound) {
            return res.status(422).json({ error: "This email was used to create another account!" });
        }
        const foundPhone = await User.findOne({ phone: phone });
        if (foundPhone) {
            return res.status(422).json({ error: "This phone number is already registered!" });
        }
    
        else {
            const user = new User({firstName, lastName, username, phone, email, password, confirmPassword, dob, country});
            await user.save();
            return res.status(200).redirect("/signin");
        }
        
    } catch(e) {
        console.log(e);
        return res.status(200).send("Failure!");
    }
})

app.get('/signin', async (req, res) => {
    return res.status(200).render('signinForm', {link1: process.env.LINK1, link2: process.env.LINK2});
})
app.post('/signinrequest', async function (req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(422).json({ error: "Please fill in all the fields!" });
      }
      const foundUser = await User.findOne({ email: email });
      if (foundUser) {
            const isMatched = await bcrypt.compare(password, foundUser.password);
            
            const token = await foundUser.generateToken();
          
        if (!isMatched) {
            return res.status(400).json({ error: "Wrong credentials!" });
        }
            
        
        res.cookie("jwtoken", token, {
            expires: new Date(Date.now() + 432000000),
            httpOnly: true
        });
        
        return res.status(200).redirect("/dashboard");
    } else {
        return res.status(400).json({ error: "Wrong credentials!" });
    }
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
});

const followController = require('./followController');
app.post('/follow/:id', authenticate, followController.followUser);
app.post('/unfollow/:id', authenticate, followController.unfollowUser);
  
app.get('/dashboard', authenticate, async function(req, res) {
    try {
        const user = req.rootUser; // Assuming this is how you retrieve the logged-in user
        const userBlogs = await BlogPost.find({ author: user._id });
        var verified = false;
        if(user.username === 'hdwarade') {
            verified = true;
        }
        return res.status(200).render("dashboard", {
            verified,
            userBlogs,
            title: user.username,
            link1: process.env.LINK1,
            link2: process.env.LINK2,
            myFirstName: user.firstName,
            myLastName: user.lastName,
            myUsername: user.username,
            myCountry: user.country,
            rootUser: user,
            user: user,
            followersCount: user.followers.length,
            followingsCount: user.followings.length,
            bio: user.bio,
            blogsCount: userBlogs.length,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/add-bio', authenticate, async (req, res) => {
    try {
        const userId = req.rootUser._id;
        const { bio } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { bio: bio },
            { new: true }
        );

        return res.redirect('/dashboard');
    } catch (error) {
        console.error("Error adding bio:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/add-college', authenticate, async (req, res) => {
    try {
        const userId = req.rootUser._id;
        const { college } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { college: college },
            { new: true }
        );

        return res.redirect('/dashboard');
    } catch (error) {
        console.error("Error adding college:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/search", authenticate, async (req, res) => {
    const searchQuery = req.query.query;
    try {
        const results = await User.find({
            $or: [
                { firstName: { $regex: searchQuery, $options: "i" } },
                { lastName: { $regex: searchQuery, $options: "i" } },
                { username: { $regex: searchQuery, $options: "i" } },
                { college: { $regex: searchQuery, $options: "i" } },
                { email: { $regex: searchQuery, $options: "i" } },
                { bio: { $regex: searchQuery, $options: "i" } },
            ],
        });

        return res.status(200).render("searchResults", {
            results,
            rootUser: req.rootUser,
            title: "Search Results",link1: process.env.LINK1, link2: process.env.LINK2,
        });
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/search-results', authenticate, async (req, res) => {
    try {
        const query = req.query.query;
        const results = await User.find({ username: query });
        res.render('searchResults', { results, user: req.rootUser, link1: process.env.LINK1, link2: process.env.LINK2 });
    } catch (err) {
        console.log(err);
        return res.send(err);
    }
});

app.post('/create-blog', authenticate, async (req, res) => {
    try {
        const { title, content } = req.body;
        const user = req.rootUser;
        
        
        const newBlogPost = new BlogPost({
            title,
            content,
            author: user._id
        });
        
        await newBlogPost.save();
        
        return res.redirect('/dashboard');
    } catch (error) {
        console.error("Error creating blog post:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/profile/:userId", authenticate, async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const user = await User.findById(userId).populate('followers').populate('followings');
           
        const userBlogs = await BlogPost.find({ author: user._id }).populate('author');
        if (!user) {
            return res.status(404).send("User not found");
        }
        var verified = false;
        if(user.username === 'hdwarade') {
            verified = true;
        }
        res.render("profile", { verified, userBlogs, user: user, title: user.username, rootUser: req.rootUser, link1: process.env.LINK1, link2: process.env.LINK2, followersCnt: user.followers.length, followingsCnt: user.followings.length, profiledName: user.firstName });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).send("Internal server error");
    }
});

app.get('/my-blogs', authenticate, async (req, res) => {
    try {
        const user = req.rootUser;

        
        const userBlogs = await BlogPost.find({ author: user._id });

        return res.status(200).redirect('/dashboard');
    } catch (error) {
        console.error("Error fetching user's blogs:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/like/:blogId', authenticate, async (req, res) => {
    try {
        const blogId = req.params.blogId;
        const user = req.rootUser;
        const blog = await BlogPost.findById(blogId);

        if (!blog) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        if (blog.likes.includes(user._id)) {
            blog.likes.pull(user._id);
        } else {
            blog.likes.push(user._id);
        }

        await blog.save();

        const referringPage = req.headers.referer || '/dashboard';

        return res.redirect(referringPage);
    } catch (error) {
        console.error('Error liking/unliking:', error);
        res.status(500).json({ error: 'An error occurred while liking/unliking the blog.' });
    }
});



app.post('/comment/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const commentText = req.body.comment;

        const blogPost = await BlogPost.findById(postId);
        if (!blogPost) {
            return res.status(404).send('Blog post not found');
        }

        blogPost.comments.push({
            author: req.rootUser._id,
            text: commentText,
            createdAt: new Date()
        });

        await blogPost.save();

        res.redirect(req.headers.referer);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/following-blogs', authenticate, async (req, res) => {
    try {
        const user = req.rootUser;

        const followingUsers = await User.find({ _id: { $in: user.followings } });

        const followingBlogs = await BlogPost.find({ author: { $in: followingUsers.map(u => u._id) } }).populate('author');
        const everyOne = await User.find({});

        res.render('following-blogs', {
            rootUser: req.rootUser,
            everyOne: everyOne,
            title: 'Following Blogs',
            followingBlogs
        });
    } catch (error) {
        console.error("Error fetching following blogs:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


app.post('/delete-blog/:id', authenticate, async (req, res) => {
    try {
        const blogId = req.params.id;
        const user = req.rootUser;

        const blog = await BlogPost.findOneAndRemove({ _id: blogId, author: user._id });

        if (!blog) {
            return res.status(404).json({ error: "Blog not found or you are not authorized to delete it." });
        }

        res.status(200).redirect(req.headers.referer);
    } catch (error) {
        console.error("Error deleting blog:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


app.post('/like/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const user = req.rootUser;

        const blogPost = await BlogPost.findById(postId);

        if (!blogPost.likes.includes(user._id)) {
            blogPost.likes.push(user._id);
            await blogPost.save();
        }

        return res.redirect('/dashboard');
    } catch (error) {
        console.error("Error liking blog post:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


app.get('/detailed-view/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const blog = await BlogPost.findById(postId).populate('author');

        if (!blog) {
            return res.status(404).send("Blog post not found");
        }

        for (const comment of blog.comments) {
            const commentDoc = await BlogPost.populate(comment, { path: 'author', select: 'username' });
            comment.set('author', commentDoc.author);
        }
        return res.status(200).render('detailedView', { blog, title: blog.title, rootUser: req.rootUser });
    } catch (error) {
        console.error("Error fetching detailed view:", error);
        return res.status(500).send("Internal server error");
    }
});

app.get('/explore', authenticate, async function(req, res) {
    try {
        const everyOne = await User.find({ college: { $ne: req.rootUser.college } });
        const userCollege = req.rootUser.college;
        const fromSameCollege = await User.find({college: userCollege});
        return res.status(200).render('explorePeople', {everyOne: everyOne, collegeFriends: fromSameCollege, userCollege: userCollege});
    } catch (err) {
        console.log(err);
        return res.status(422).send(`Error in fetching the page due to ${err}`);
    };
});



app.post('/delete-blog/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const user = req.rootUser;


        const post = await BlogPost.findOneAndRemove({ _id: postId, author: user._id });

        if (!post) {
            return res.status(404).json({ error: "Post not found or you are not authorized to delete it." });
        }


        await User.updateMany({ _id: { $in: post.likes } }, { $pull: { likes: post._id } });

        res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


app.post('/delete-comment/:postId/:commentId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const commentId = req.params.commentId;
        const user = req.rootUser;


        const post = await BlogPost.findById(postId);

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }


        const comment = post.comments.id(commentId);
        if (!comment || !comment.author.equals(user._id)) {
            return res.status(404).json({ error: "Comment not found or you are not authorized to delete it." });
        }


        post.comments.pull(commentId);
        await post.save();

        res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.error("Error deleting comment:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});




app.get('/edit-profile', authenticate, async function(req, res) {
    const user = req.rootUser;
    return res.status(200).render('settingPage', {user: user});
})

app.post('/update-settings', authenticate, async (req, res) => {
    try {
        const user = req.rootUser;
        const { firstName, lastName, country, email, college, bio } = req.body;


        user.firstName = firstName;
        user.lastName = lastName;
        user.country = country;
        user.email = email;
        user.college = college;
        user.bio = bio;
        
        await user.save();

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// show followers

app.get('/get-followers', authenticate, async (req, res) => {
    try {
        const userId = req.rootUser._id;
        const user = await User.findById(userId).populate('followers', 'firstName lastName username');
        const followers = user.followers;

        res.status(200).render("followersList", {followers: followers});
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// show dynamic followers
// app.get('/get-followers/:userID', authenticate, async (req, res) => {
//     try {
//         const userId = req.params.userID;
//         const user = await User.findById(userId).populate('followers', 'firstName lastName username');
//         const followers = user.followers;

//         res.status(200).render("followersList", {followers: followers});
//     } catch (error) {
//         console.error('Error fetching followers:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

app.post('/deleteAccount/:userID', authenticate, async function(req, res) {
    try {
        const userId = req.params.userID;
        const { delUsername } = req.body;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).render("faultPage", {msg: "User not found"});
        }

        if (delUsername === req.rootUser.username) {
            await BlogPost.deleteMany({ author: userId });

            await BlogPost.updateMany(
                { likes: userId },
                { $pull: { likes: userId } }
            );

            await BlogPost.updateMany(
                { 'comments.author': userId },
                { $pull: { comments: { author: userId } } }
            );

            const followers = await User.find({ followings: userId });
            for (const follower of followers) {
                follower.followings.pull(userId);
                await follower.save();
            }

            const followings = await User.find({ followers: userId });
            for (const following of followings) {
                following.followers.pull(userId);
                await following.save();
            }

            await User.findByIdAndDelete(userId);

            return res.status(200).redirect('/');
        } else {
            return res.status(422).render("faultPage", {msg: "Username does not match!!"});
        }
    } catch (err) {
        console.log(err);
        return res.status(500).render("faultPage", {msg: "Internal server error."});
    }
});


app.get('/get-followings', authenticate, async function(req, res) {
    try {
        const userId = req.rootUser._id;
    } catch (err) {
        console.log('Error', err);
        res.status(422).send("Error while fetching your followings list, we're working on it!");
    }
})

app.get('/logout', authenticate, async function(req, res) {
    try {
        // cookie clear karav laagel
        res.clearCookie('jwtoken');
        return res.status(200).redirect('/');
    } catch (err) {
        return res.status(422).send("There was an error while trying to logout... Please try doing it after some time!");
    }
})

app.use('/uploads', express.static('uploads'));

app.post('/uploads', authenticate, upload.single("profileImage"), async function(req, res) {
    try {
        const userFileName = req.file.filename;
        const thisUser = await User.findOne({username: req.rootUser.username});

        thisUser.uploads.push(userFileName);

        await thisUser.save();
        
        return res.redirect('/dashboard');
    } catch (err) {
        return res.send(err);
    }
});

app.post('/deleteProfileImage/:userID', authenticate, async function(req, res) {
    const userId = req.params.userID;

    try {
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const uploadsDirectory = path.join(__dirname, 'uploads');
  
      for (const fileName of user.uploads) {
        const filePath = path.join(uploadsDirectory, fileName);
  
        const fileExists = await fs.pathExists(filePath);
  
        if (fileExists) {
          await fs.unlink(filePath);
          console.log(`Deleted file: ${fileName}`);
        } else {
          console.log(`File not found: ${fileName}`);
        }
      }
  
      user.uploads = [];
  
      await user.save();
  
      res.status(200).redirect('/dashboard');
    } catch (error) {
      console.error('Error deleting uploads:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
})


app.get('/mostLikedBlogs', authenticate, async (req, res) => {
    try {
        const popularPosts = await BlogPost.find({}).sort({ likes: -1 }).exec();
    
        res.render('mostliked', { popularPosts });
    } catch (error) {
        console.error('Error fetching popular posts:', error);
        res.status(500).send('Internal server error');
    }
});


app.get('/mostCommented', authenticate, async function(req, res) {
    console.log('success');
    return res.status(200).send(req.rootUser.username);
});


app.get('/about', async function(req, res) {
    return res.status(200).render('about');
})

let admins = ['harshalwarade344@gmail.com'];
// admin page special logics
app.get('/renderadminpage', async (req, res) => {
    
})
app.get('/SQWYzsf73SAmxzb2', authenticate, async function(req, res) {
    let permission = false;
    for(let i = 0; i < admins.length; i++) {
        if(req.rootUser.email == admins[i]) {
            permission = true;
        }
    }
    if(permission) {
        const alldata = await User.find({});
        if(!alldata) {
            console.log(`Error fetching all the data`);
            return res.status(422).send("Error in fetching the data!!");
        } else {
            return res.status(200).render('adminviewpage', {alldata:alldata});
        }
    } else {
        return res.status(403).send("You are not authorized to view this page!");
    }
})

app.listen(port, (err) => {
    if (err) {
        console.log("Error occurred while setting up the port");
    } else {
        console.log(`Application is running on http://localhost:${port}`);
    }
});
