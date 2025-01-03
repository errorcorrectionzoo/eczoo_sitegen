//
// Define which codes we consider "notable" to be marked in the code hierarchy
// tree displayed on the code pages.
//
// - I'm not too fond of listing the codes here manually, but I don't see a much better
//   solution for now.
// - I wouldn't really be in favor of marking them in the YAML data at this point
//   either, because at the moment, the "notability" of a code seems to be more of
//   an issue of how to display it, not an inherent property of the code.
// - Also, I might update my mind on how to define/quantify the "notability" of a code.
//   E.g., use different degrees of "notability"?  It's better if all notability-related
//   info is all in the same place for now, so its structure/form/shape can easily be
//   updated/changed.
//

export default {
    notable_codes: new Set([
        'coherent_state_c-q',
        'constant_weight',
        'gray',
        'quantum_inspired',
        'self_dual_over_rings',
        'small_distance',
        'univ_opt',
        'combinatorial_design',
        'points_into_lattices',
        'modulation',
        'polytope',
        'spherical_design',
        'lcc',
        'ldc',
        'locally_recoverable',
        'ltc',
        'ag',
        'cyclic',
        'evaluation_varieties',
        'q-ary_ldpc',
        'mds',
        'orthogonal_array',
        'perfect',
        'projective',
        'q-ary_linear',
        'approximate_qecc',
        'asymmetric_qecc',
        'dynamic_gen',
        'eaqecc',
        'hamiltonian',
        'holographic',
        'generalized_homological_product',
        'self_correct',
        'single_shot',
        'single_subsystem',
        'fermions',
        'fermions_into_qubits',
        'fock_state',
        'oscillator_stabilizer',
        'css',
        'stabilizer',
        'oecc',
        'color',
        'twist_defect_color',
        'da',
        'fracton',
        'translationally_invariant_subsystem',
        'translationally_invariant_stabilizer',
        'clifford-deformed_surface',
        'twist_defect_surface',
        'higher_dimensional_surface',
        'quantum_double',
        'topological',
        'qldpc',
        'constant_excitation',
        'qltc',
        'quantum_concatenated',
        'quantum_cyclic',
        'quantum_mds',
        'ea_mds',
        'quantum_perfect',
        'small_distance_quantum',
        'ecc',
        'oaecc',
        'eacq',
        'qecc',

        // some additions (PhF)
        'quantum_into_quantum',
        'qubits_into_qubits',
        'surface',
        'bicycle',
        'quantum_reed_muller',
    ]),
};