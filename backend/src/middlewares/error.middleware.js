export const errorHandler=(err,req,res,next)=>{
    const statusCode=err.statusCode||500;  //error is initialized with the status code of the error or 500 if no status code is provided
    let message=err.message||"Internal Server Error";
    if(err.error&&err.error.description){
        message=err.error.description; // Capture Razorpay error messages
    }

    return res.status(statusCode).json({
        success:false,
        statusCode,
        message,
        errors:err.errors||[], //error is initialized with the errors array of the error or an empty array if no errors array is provided
    }); //this sends the error to the client as a json response
}