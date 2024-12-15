//
// run_profiler
//

const fsPromises = require('fs/promises');

const util = require('util');

const inspector = require('inspector');
let inspector_session = new inspector.Session()

inspector_session.connect();

let inspector_session_post = util.promisify(inspector_session.post.bind(inspector_session));


let profiler_running = false;

async function run_profiler(fn)
{
    if (profiler_running) {
        throw new Error('Profiler already running.');
    }
    profiler_running = true;

    let profile;
    try {
        await inspector_session_post('Profiler.enable');
        await inspector_session_post('Profiler.start');

        console.log('About to profile function');

        // run the code we want to profile.
        await fn();

        console.log('Profiling function done');

        profile = (await inspector_session_post('Profiler.stop')).profile;
    } catch (err) {
        console.error('Profiler error:', err);
    } finally {
        await inspector_session_post('Profiler.disable');
        profiler_running = false;
    }
    return profile;
}


async function run_and_dump_profile(fn, file_name_prefix)
{
    let profile = await run_profiler(fn);
    
    try {
        await fsPromises.writeFile(`${file_name_prefix}_${(new Date()).toISOString()}.json`,
                                   JSON.stringify(profile));
    } catch (err) {
        console.error('Error writing profile file', err);
    }
}


export default { run_profiler, run_and_dump_profile };
