import rateLimit from "express-rate-limit"; //use for rate limiting the requests
import { RedisStore } from "rate-limit-redis";  //use for storing the rate limit data in redis
import Redis from "ioredis"; //use for connecting to redis

//create a dedicated Redis connection for the rate limiter
const redisClient=process.env.REDIS_URL?new Redis(process.env.REDIS_URL):new Redis({host:"127.0.0.1",port:6379});

export const tatkalRateLimiter=rateLimit({
    windowMs:60*1000, //1 minute window
    max:5, //limit each IP to 5 requests per `windowMs`
    standardHeaders:true, //return rate limit info in the `RateLimit-*` headers
    legacyHeaders:false, //disable the `X-RateLimit-*` headers
    store:new RedisStore({
        sendCommand:(...args)=>redisClient.call(...args),
    }),
    handler:(req,res)=>{    //when rate limit exceeds then run this
        res.status(429).json({
            success:false,
            message:"Too many booking attempts from this IP. Please try again after a minute.",
            data:null
        });
    }
});
