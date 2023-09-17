const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'USER', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'USER' }],
    blogCreatedAt: { type: Date, default: Date.now },
    comments: [{
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'USER' },
        text: {type: String},
        createdAt: { type: Date, default: Date.now }
    }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'USER' }]
});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

module.exports = BlogPost;
