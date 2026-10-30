//app.js is generally used to create and configure your express application
import express from "express"; //express is a framework for building web applications and APIs
import cors from "cors"; //cors is a middleware for enabling cross-origin resource sharing
import cookieParser from "cookie-parser"; //cookie-parser is a middleware for parsing cookies from the request headers
import compression from "compression";  //compression is a middleware that compresses http responses using algorithms such as gzip/Brotli depending on negotiation
import helmet from "helmet";    //helmet is a middleware that sets various http headers
import morgan from "morgan";    //morgan is a middleware that logs http requests to the console

const app=express();    //creates an express application

//compress all responses (must be first)
app.use(compression());

//set secure http headers
//express middleware that sets various http security headers to improve the security of your web application
//crossOriginResourcePolicy:false means helmet baaki security headers manage karega but CORP header ko helmet manage nahi karega
app.use(helmet({crossOriginResourcePolicy:false}));


app.use(morgan("dev")); //morgan is a middleware that logs http requests to the console

//enables cors
//this allows frontend to send request to backend
//origin=true means all origins are allowed and credentials=true means cookies can be sent to the server
app.use(
    cors({
        origin:true,
        credentials:true,
    })
);

//parse body
app.use(express.json({limit:"16kb"}));  //this middleware parses incoming json helps in destructuring in req.body
app.use(express.urlencoded({extended:true,limit:"16kb"}));  //this middleware parses incoming url encoded data  extended=true allows nested objects

app.use(cookieParser()); //this middleware parses incoming cookies from the browser stores them in req.cookies

//import all routes


//health check route for Render


//global error handler
import { errorHandler } from "./middlewares/error.middleware.js";
app.use(errorHandler);
export default app;