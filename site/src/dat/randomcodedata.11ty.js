
const data = {
    layout: null,
    permalink: 'dat/randomcodedata.json',
};

const render = async (data) => {

    const { generate_random_code_data } =
          await import('@errorcorrectionzoo/jscomponents/randomcode/generate_data.js');

    const random_code_data = generate_random_code_data({eczoodb: data.eczoodb});

    return JSON.stringify(random_code_data); //, undefined, 4);

};


module.exports = { data, render, };
