
const usernames = new Set();


const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const BlogPost = require('./models/blogPostSchema');

const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded());

// secret directory
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
// route towards creating account
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
            console.log("Success");
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
            
        // const token = jwt.sign({ _id: foundUser._id }, process.env.SECRETKEY);
        
        
        res.cookie("jwtoken", token, {
            expires: new Date(Date.now() + 432000000),
            httpOnly: true
        });
        
        return res.status(200).redirect('/dashboard');
    } else {
        console.log(foundUser.email);
        console.log(foundUser.password);
        return res.status(400).json({ error: "Wrong credentials!" });
    }
    } catch (error) {
      // console.log(`SignIn error: ${error}`);
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
            rootUser: user, // Pass the user object to the template
            user: user,
            followersCount: user.followers.length, // Also pass the user object to the template
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

        return res.redirect('/dashboard'); // Redirect to the dashboard after updating the bio
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

        return res.redirect('/dashboard'); // Redirect to the dashboard after updating the college
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
            ],
        });

        return res.status(200).render("searchResults", {
            results,
            rootUser: req.rootUser, // Ensure req.user is correctly set
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
        const results = await User.find({ username: query }); // Replace this with your actual query logic
        res.render('searchResults', { results, user: req.rootUser, link1: process.env.LINK1, link2: process.env.LINK2 }); // Pass the rootUser to the template
    } catch (err) {
        console.log(err);
        return res.send(err);
    }
});

app.post('/create-blog', authenticate, async (req, res) => {
    try {
        const { title, content } = req.body;
        const user = req.rootUser; // Get the logged-in user
        
        // Create a new blog post
        const newBlogPost = new BlogPost({
            title,
            content,
            author: user._id
        });

        console.log(newBlogPost); // Log the new blog post object
        
        await newBlogPost.save();

        console.log("Blog post saved successfully!");
        
        return res.redirect('/dashboard'); // Redirect back to the dashboard after creating the blog post
    } catch (error) {
        console.error("Error creating blog post:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/profile/:userId", authenticate, async (req, res) => {
    const userId = req.params.userId;
    
    try {
        const user = await User.findById(userId).populate('followers').populate('followings');
        // const userBlogs = await BlogPost.find({author: user._id});    
        const userBlogs = await BlogPost.find({ author: user._id }).populate('author');
        if (!user) {
            return res.status(404).send("User not found");
        }
        var verified = false;
        console.log(user.username)
        if(user.username === 'hdwarade') {
            verified = true;
        }
        res.render("profile", { verified, userBlogs, user: user, title: user.username, rootUser: req.rootUser, link1: process.env.LINK1, link2: process.env.LINK2, followersCnt: user.followers.length, followingsCnt: user.followings.length });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).send("Internal server error");
    }
});

app.get('/my-blogs', authenticate, async (req, res) => {
    try {
        const user = req.rootUser; // Get the logged-in user

        // Query the database to retrieve blogs authored by the user
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
        const user = req.rootUser; // Make sure req.user is populated properly
        const blog = await BlogPost.findById(blogId);

        if (!blog) {
            return res.status(404).json({ error: 'Blog not found' });
        }

        if (blog.likes.includes(user._id)) {
            // User already liked the blog, so unlike it
            blog.likes.pull(user._id);
        } else {
            // User hasn't liked the blog yet, so like it
            blog.likes.push(user._id);
        }

        await blog.save();

        // Get the referring page URL from the request headers
        const referringPage = req.headers.referer || '/dashboard';

        return res.redirect(referringPage); // Redirect back to the referring page
    } catch (error) {
        console.error('Error liking/unliking:', error);
        res.status(500).json({ error: 'An error occurred while liking/unliking the blog.' });
    }
});



app.post('/comment/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const commentText = req.body.comment;

        // Find the blog post by ID
        const blogPost = await BlogPost.findById(postId);
        if (!blogPost) {
            return res.status(404).send('Blog post not found');
        }

        // Add the comment to the blog post's comments array
        blogPost.comments.push({
            author: req.rootUser._id, // Assuming you have user authentication
            text: commentText,
            createdAt: new Date()
        });

        // Save the updated blog post
        await blogPost.save();

        res.redirect(req.headers.referer); // Redirect to the blog post's detailed view
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/following-blogs', authenticate, async (req, res) => {
    try {
        const user = req.rootUser; // Get the logged-in user

        // Find the users that the logged-in user is following
        const followingUsers = await User.find({ _id: { $in: user.followings } });

        // Find blogs of the following users
        const followingBlogs = await BlogPost.find({ author: { $in: followingUsers.map(u => u._id) } }).populate('author');
        const everyOne = await User.find({});
        // console.log(everyOne[0]);
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
        const user = req.rootUser; // Get the logged-in user

        // Find the blog by ID and ensure that the logged-in user is the author
        const blog = await BlogPost.findOneAndRemove({ _id: blogId, author: user._id });

        if (!blog) {
            return res.status(404).json({ error: "Blog not found or you are not authorized to delete it." });
        }

        res.status(200).redirect('/dashboard');
    } catch (error) {
        console.error("Error deleting blog:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


// Like a blog post
app.post('/like/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const user = req.rootUser;

        // Find the blog post by ID
        const blogPost = await BlogPost.findById(postId);

        // Add the user's ID to the likes array if not already liked
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

// Comment on a blog post
// app.post('/comment/:postId', authenticate, async (req, res) => {
//     try {
//         const postId = req.params.postId;
//         const user = req.rootUser;
//         const { text } = req.body;

//         // Find the blog post by ID
//         const blogPost = await BlogPost.findById(postId);

//         // Add the comment details to the comments array
//         blogPost.comments.push({ author: user._id, text: text, createdAt: new Date() });
//         await blogPost.save();

//         return res.redirect(req.headers.referer);
//     } catch (error) {
//         console.error("Error commenting on blog post:", error);
//         return res.status(500).json({ error: "Internal server error" });
//     }
// });



// app.get('/detailed-view/:postId', authenticate, async (req, res) => {
//     try {
//         const postId = req.params.postId;
//         const blog = await BlogPost.findById(postId).populate('author', 'username');

//         if (!blog) {
//             return res.status(404).send("Blog post not found");
//         }
//         console.log(blog.author.username);
//         return res.status(200).render('detailedView', { blog, title: blog.title });
//     } catch (error) {
//         console.error("Error fetching detailed view:", error);
//         return res.status(500).send("Internal server error");
//     }
// });


app.get('/detailed-view/:postId', authenticate, async (req, res) => {
    try {
        const postId = req.params.postId;
        const blog = await BlogPost.findById(postId).populate('author');

        if (!blog) {
            return res.status(404).send("Blog post not found");
        }

        // Loop through comments, convert to Mongoose documents, and populate their authors individually
        for (const comment of blog.comments) {
            const commentDoc = await BlogPost.populate(comment, { path: 'author', select: 'username' });
            comment.set('author', commentDoc.author); // Set the populated author to the comment
        }

        return res.status(200).render('detailedView', { blog, title: blog.title, rootUser: req.rootUser });
    } catch (error) {
        console.error("Error fetching detailed view:", error);
        return res.status(500).send("Internal server error");
    }
});

app.get('/explore', authenticate, async function(req, res) {
    try {
        const everyOne = await User.find({});
        return res.status(200).render('explorePeople', {everyOne: everyOne});
    } catch (err) {
        console.log(err);
        return res.status(422).send(`Error in fetching the page due to ${err}`);
    };
});

app.listen(port, (err) => {
    if (err) {
        console.log("Error occurred while setting up the port");
    } else {
        console.log(`Application is running on http://localhost:${port}`);
    }
});
