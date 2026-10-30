import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken"; //used for verifying the token

//verifies the json web yoken to authenticate users and attach user data to the request
const verifyJWT=asyncHandler(async(req,res,next)=>{
    try{
        //gets the token from the cookies or the authorization header
        const token=req.cookies?.accessToken||req.header("Authorization")?.replace("Bearer ","");
        if(!token){
            throw new ApiError(401,"Unauthorised Request\n"); //throws an error if no token is found
        }
        const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET); //verifies the token
        //if the token is not valid the verify function will throw the error
        const user=await User.findById(decodedToken._id).select("-password -refreshToken"); //finds the user by the decoded token
    
        if(!user){
            throw new ApiError(401,"Invalid Access Token\n"); //throws an error if the user is not found
        }
        req.user=user; //attaches the user to the request object
        next();
    }
    catch(error){
        throw new ApiError(401,error?.message||"Invalid Access Token\n");
    }
})

//verifies the role of the user using the verifyJWT middleware
//this is role based access middleware
//...roles is rest operator , jitne bhi roles pass honge unko ek array mein store krdega
const verifyRole=(...roles)=>(req,res,next)=>{
    //checks if the user is authorized
    //if user is not authenticated or the role of the user is not in the rest operator roles then deny access
    if(!req.user||!roles.includes(req.user.role)){
        throw new ApiError(403,"Access denied. Insufficient permissions."); //throws an error if the user is not authorized
    }

    next(); //passes the request to the next middleware
};

export{verifyJWT,verifyRole};