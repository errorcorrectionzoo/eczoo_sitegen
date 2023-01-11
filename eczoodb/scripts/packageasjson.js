import fs from 'fs';

let in_content = null;
try {
    in_content = fs.readFileSync(0).toString('utf-8')
} catch (err) {
    console.error("Cannot read input!");
    throw err;
}


const d = { data: in_content };


process.stdout.write( JSON.stringify(d) );
