import {resolve} from "path"
import {config} from "dotenv"
config({path : resolve("./config/.env")})
import express, { Request , Response , NextFunction } from "express"
import cors from "cors"
import helmet from "helmet"
import {rateLimit} from "express-rate-limit"
import { AppError } from "./utils/classError"
import adminRouter from "./moudles/admin/admin.controller"
import studentRouter from "./moudles/student/student.controller"
import termRouter from "./moudles/Term/Term.controller"
import courseRouter from "./moudles/Course/Course.controller"
import enrollmentRouter from "./moudles/Enrollment/Enrollment.controller"
import gradeRouter from "./moudles/Grade/Grade.controller"
import gradeScaleRouter from "./moudles/Gradescale/Gradescale.controller"
import departmentRouter from "./moudles/Department/Department.controller"
import creditRuleRouter from "./moudles/Creditrule/Creditrule.controller"




const app:express.Application = express()
const port : string | number = process.env.PORT || 5000

const limiter = rateLimit({
	windowMs: 5 * 60 * 1000, 
	limit: 100,
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
	ipv6Subnet: 56,
})



const bootStrap = ()=>{
    app.use(express.json())
    app.use(cors())
    app.use(helmet())
    app.use(limiter)

    app.use("/admin", adminRouter);
    app.use("/student", studentRouter);
    app.use("/term", termRouter);
    app.use("/course", courseRouter);
    app.use("/enrollment", enrollmentRouter);
    app.use("/grade", gradeRouter);
    app.use("/grade-scale", gradeScaleRouter);
    app.use("/department", departmentRouter);
    app.use("/credit-rules", creditRuleRouter);


    app.get("/",(req:Request,res:Response,next:NextFunction)=>{
        return res.status(200).json({message:`welcome on my app`})
    })



    app.get("{/*demo}",(req:Request,res:Response,next:NextFunction)=>{
        throw new AppError(`invalid url ${req.originalUrl}`,  404 )
    })

    app.use((err:AppError,req:Request,res:Response,next:NextFunction)=>{
        return res.status(err.cause as unknown as number || 500).json({message:err.message , stack:err.stack})
    })



    app.listen(port, ()=>{
        console.log(`server is running on port ${port} `);
        
    })
}



export default bootStrap