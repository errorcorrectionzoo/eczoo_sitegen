module.exports = {

    popular_code_id_list: [
        'binary_linear',
        'q-ary_additive',
        'reed_solomon',
        'reed_muller',
        'ldpc',
        'polar',
        'rank_metric',
        'spacetime',

        'stabilizer',
        'css',
        'good_qldpc',
        'surface',
        'color',

        'topological',
        'holographic',
        'eaqecc',

        'gkp',
        'cat',
    ],



    max_display_box_codelists: 20, //16,


    stats_spec: [
        ['total_num_codes', {label: 'code entries'}],
        ['total_num_kingdoms', {label: 'kingdoms'}],
        ['total_num_domains', {label: 'domains'}],
        ['code_familyhead_ids_and_codetypes', { spec_list: [
            [['ecc', 'classical_into_quantum'], 'classical codes'],
            [['quantum_into_quantum'], 'quantum codes'],
            [['topological'], 'topological codes'],
            [['css'], 'CSS codes'],
            [['qldpc'],'quantum LDPC codes'],
            [['oscillators'], 'bosonic codes'],
        ]} ],
    ]
};
