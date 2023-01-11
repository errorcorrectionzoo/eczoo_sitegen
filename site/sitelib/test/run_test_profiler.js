

async function mytestfun(a, b)
{
    //console.log('mytestfun', a, b);
    if (a > b) {
        return (await mytestfun(a-2, b)) * (await mytestfun(a-1, b));
    }
    return 1;
}


async function run_mytestfun_profiled()
{
    const { run_and_dump_profile } = await import('../run_profiler.js');

    const mytestfunction_many = async () => {
        let z = 0;
        for (let j = 0; j < 1000000; ++j) {
            if (j % 10000 === 0) {
                console.log('will call the mytestfun funcion etc., j=', j);
            }
            z += await mytestfun(10, 1);
        }
        console.log('Done. z = ', z);
    };

    run_and_dump_profile( mytestfunction_many, './my_test_profileX' );
}


run_mytestfun_profiled();
