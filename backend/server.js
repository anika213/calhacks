const express = require('express');
const cors = require('cors');

// const { RateLimiterMemory } = require('rate-limiter-flexible');
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
require('dotenv').config();
const mongoose = require("mongoose");
const stream = require('stream');

const axios= require("axios");
const app = express();
const router = express.Router()


const uri = process.env.MONGO_URI
console.log(uri)
const client = new MongoClient(uri);
const database = client.db(process.env.DATABASE_NAME);

const bodyParser = require('body-parser');
app.use(cors());


// app.use(bodyParser.json({ limit: '30mb' }));
// app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
// ;
async function connection(){
    try {
        // Connect to the mongo cluster
        await client.connect();
        console.log("connected to MONGOdb");
       
    } catch (e) {
        console.error(e);
}
}
connection().catch(console.error);

app.listen(8000, () => {
    console.log(`Server is running on port 8000.`);
  });
