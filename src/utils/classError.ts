
export class AppError extends Error{
        constructor( public message:string , public cause?:number )
        {
            super(message)
        }

}