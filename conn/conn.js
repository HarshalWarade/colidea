const mongoose = require('mongoose');
const env = require('dotenv');
const db = process.env.DATABASE;
mongoose.connect(db).then(function() {
    console.log('Connection successful');
}).catch(function(error) {
    console.log(error);
})