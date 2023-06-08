const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 9000


app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c9tdfjs.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
    
    const usersCollection = client.db('summerCampDB').collection('users')
    const classesCollection = client.db('summerCampDB').collection('classes')
    const bookingsCollection = client.db('summerCampDB').collection('bookings')

    //put method is used to avoid duplicate user / to solve dupliocate user issue
    app.put('/users/:email', async(req,res)=>{//we've used put cz if there's any data in database put method finds it by email, if the user doesn't exist then it inserts new user  
        const email = req.params.email; //receive email from parameter
        const user = req.body;
        const query = {email: email};
        const option = {upsert:true};//unique user will be stored in db
        const updateDoc = {
            $set: user //user from the body is set here
        }
        const result = await usersCollection.updateOne(query, updateDoc, option)
        console.log(result);
        res.send(result)
    })

    //get user
    app.get('/users/:email', async (req,res)=>{
      const email = req.params.email
      const query ={email:email}
      const result = await usersCollection.findOne(query)
      console.log(result);
      res.send(result)
    })


//get all class
    app.get('/classes', async (req,res)=>{
      const result = await classesCollection.find().toArray()
      res.send(result)
    })
     //get a single class
    app.get('/class/:id', async (req,res)=>{
      const id = req.params.id
      const query ={_id:new ObjectId(id)}
      const result = await classesCollection.findOne(query)
      console.log(result);
      res.send(result)
    })

   

    app.post('/classes', async(req,res)=>{
      const classes = req.body;
      console.log(classes);
      const result = await classesCollection.insertOne(classes)
      res.send(result)
    })
    //update class booking status
    app.patch('/classes/status/:id',async(req,res)=>{
      const id = req.params.id;
      const status = req.body.status;
      const query = {_id: new ObjectId(id)}
      const updateDoc ={
        $set:{
          booked: status
        },
      }
      const update = await classesCollection.updateOne(query,updateDoc)
      res.send(update)
    })
    //save a booking in database
    app.post('/bookings', async(req,res)=>{
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking)
      res.send(result)
    })


  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Summer Camp Server is running..')
  })
  
  app.listen(port, () => {
    console.log(`Summer Camp is running on port ${port}`)
  })