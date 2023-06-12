const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 9000
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)


app.use(cors())
app.use(express.json())
app.use(morgan('dev'))



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c9tdfjs.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


//validate jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log(authorization);
  // if (!authorization) {
  //   return res.status(401).send({ error: true, message: 'unauthorized access' })
  // }
  // // bearer token
  const token = authorization.split(' ')[1]
  console.log(token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded
    next()
  })
}


async function run() {
    
    const usersCollection = client.db('summerCampDB').collection('users')
    const classesCollection = client.db('summerCampDB').collection('classes')
    const bookingsCollection = client.db('summerCampDB').collection('bookings')

    

    //generate jwt token
    app.post('/jwt', (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '7d',
      })
      
      console.log(token);
      res.send({token})
    })

    app.get('/users', async (req,res)=>{
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    //put method is used to avoid duplicate user / to solve dupliocate user issue
    app.put('/users/:email', async(req,res)=>{//we've used put cz if there's any data in database put method finds it by email, if the user doesn't exist then it inserts new user  
        const email = req.params.email; //receive email from parameter
        const user = req.body;
        const query = {email: email};
        const option = {upsert:true};//unique user will be stored in db
        const updateDoc = {
            $set: user
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


//making admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

//making instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

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

      //get all classes for instructor
      app.get('/classes/:email', verifyJWT, async (req,res)=>{
        const decodedEmail = req.decoded.email
        console.log(decodedEmail);
        const email = req.params.email
        if(email!== decodedEmail){
          return res.status(403).send({error: true, message:'Unauthorzed'})
        }
        const query ={'instructor.email':email}
        const result = await classesCollection.find(query).toArray()
        console.log(result);
        res.send(result)
      })

   //delete class
   app.delete('/classes/:id', async(req,res)=>{
    const id = req.params.id
    const query ={_id: new ObjectId(id)}
    const result = await classesCollection.deleteOne(query)
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
    //get bookings for student
    app.get('/bookings/instructor', async(req,res)=>{
      const email = req.query.email
      if(!email){
        res.send([])
      }
      const query ={instructor:email}
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })
    //get bookings for instructor
    app.get('/bookings', async(req,res)=>{
      const email = req.query.email
      if(!email){
        res.send([])
      }
      const query ={'student.email':email}
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })

    //GENERATE CLIENT SECRET
    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body
      const amount = parseFloat(price) * 100
      if (!price) return
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })

      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })


    //save a booking in database
    app.post('/bookings', async(req,res)=>{
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking)

      if (result.insertedId) {
        // Send confirmation email to guest
        sendMail(
          {
            subject: 'Booking Successful!',
            message: `Booking Id: ${result?.insertedId}, TransactionId: ${booking.transactionId}`,
          },
          booking?.student?.email
        )
        // Send confirmation email to host
        sendMail(
          {
            subject: 'Your room got booked!',
            message: `Booking Id: ${result?.insertedId}, TransactionId: ${booking.transactionId}. Check dashboard for more info`,
          },
          booking?.host
        )
      }

      res.send(result)
    })

    //delete a booking
    app.delete('/bookings/:id', async(req,res)=>{
      const id = req.params.id
      const query ={_id: new ObjectId(id)}
      const result = await bookingsCollection.deleteOne(query)
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