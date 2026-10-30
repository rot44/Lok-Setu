import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

//connects to mongoDB and returns a connection instance
//node.js has to communicate with the mongoDB server over the network
//that can take some time
//using async/await because this operation is time consuming
const connectDB=async()=>{
    try{
        const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`); //connects to MongoDB with the specified URI and database name
        console.log(`MongoDB connected successfully and host is ${connectionInstance.connection.host}`); //logs the connection instance to the console
        //it will display the host - that what server of mongodb is connected
    }
    catch(err){
        console.log("MongoDB connection failed ",err);
        process.exit(1);    //exit from the application if connection fails
    }
}

//exports the connectDB function to be used in other files
export default connectDB;
