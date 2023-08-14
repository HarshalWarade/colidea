// followController.js
const User = require('./models/userSchema');

module.exports.followUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUser = req.rootUser;

        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the currentUser is already following the targetUser
        if (currentUser.followings.includes(targetUserId)) {
            return res.status(400).json({ error: 'You are already followings this user' });
        }

        // Update the followings list of the currentUser
        currentUser.followings.push(targetUserId); // Add the targetUserId
        await currentUser.save();

        // Update the followers list of the targetUser
        targetUser.followers.push(currentUser._id); // Add the currentUser._id
        await targetUser.save();

        // return res.status(200).json({ message: 'User followed successfully' });
        return res.redirect(`/profile/${targetUserId}`);
    } catch (error) {
        console.error('Error followings user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports.unfollowUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUser = req.rootUser;

        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the currentUser is already followings the targetUser
        if (!currentUser.followings.includes(targetUserId)) {
            return res.status(400).json({ error: 'You are not followings this user' });
        }

        // Remove the targetUser from the followings list of the currentUser
        currentUser.followings = currentUser.followings.filter(id => id.toString() !== targetUserId);
        await currentUser.save();

        // Remove the currentUser from the followers list of the targetUser
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUser._id.toString());
        await targetUser.save();

        // Also update the targetUser's followingss
        targetUser.followings = targetUser.followings.filter(id => id.toString() !== currentUser._id.toString());
        await targetUser.save();

        // return res.status(200).json({ message: 'User unfollowed successfully' });
        return res.redirect(`/profile/${targetUserId}`);
    } catch (error) {
        console.error('Error unfollowing user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
