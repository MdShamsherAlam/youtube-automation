
function reverString(str){
let reverst=""
for(let i=str.length-1;i>=0;i--){
    reverst+=str[i]
}
return reverst

}
const output=reverString("shamsher")
console.log(output)