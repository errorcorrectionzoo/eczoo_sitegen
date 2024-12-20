
import { render_person } from '@errorcorrectionzoo/eczoodb/render_person.js';

const data = {
    title: 'Team',
    tags: ['sitePage'],
};

const zoo_roles_list = ['zookeeper', 'architect'];

const render = async (data) => {

    const { eczoodb } = data;

    let zoo_contributors_by_team = {
        core: [],
        veterinarians: [],
        code_contributors: [],
    };

    for (const [user_id, user] of Object.entries(eczoodb.objects.user)) {

        const zooteam = user.zooteam || 'code_contributors';

        let d = zoo_contributors_by_team[zooteam];

        d.push(user);
    }

    let s = '';

    s += `<h1>The Zoo core team</h1>

<section class="tiles-collection person-list">`;

    let people_core = zoo_contributors_by_team.core;

    people_core.sort( (a, b) => (
        zoo_roles_list.indexOf(a.zoorole) - zoo_roles_list.indexOf(b.zoorole)
    ) );

    for (const person of people_core) {
        s += render_person(person);
    }

    s += `
</section>

<h1>With the awesome help of:</h1>

<h2>Veterinarians</h2>

<section class="tiles-collection person-list">`;


    let people_veterinarians = zoo_contributors_by_team.veterinarians;

    people_veterinarians.sort( (a, b) => (
        a.name.localeCompare( b.name )
    ) );

    for (const person of people_veterinarians) {
        s += render_person(person);
    }

    s += `
</section>

<h2>Code contributions</h2>

<section class="tiles-collection person-list two-columns">
`;

    let people_code_contributors = zoo_contributors_by_team.code_contributors.map(
        (person) => {
            const earliest_contribution = eczoodb.user_earliest_contribution(person);
            const earliest_contribution_msepoch =
                  (earliest_contribution !== null)
                  ? earliest_contribution.getTime()
                  : null;
            return {
                person,
                earliest_contribution_msepoch,
            };
        }
    );
    people_code_contributors.sort(
        (a, b) => a.earliest_contribution_msepoch - b.earliest_contribution_msepoch
    );

    for (const person_info of people_code_contributors) {
        if (person_info.earliest_contribution_msepoch !== null) {
            s += render_person(person_info.person);
        }
    }

    s += `</section>`;

    s += `
<p>
  Contributors are listed in chronological order.  See also
  the <a href="https://github.com/errorcorrectionzoo/eczoo_data/graphs/contributors"
         target="_blank">list of contributors on github.org</a>.
</p>

<p>
  The error correction zoo&#x27;s data and related codes is stored on
  <a href="https://github.com/errorcorrectionzoo/eczoo_data"
  target="_blank">github.com</a>.  Feel free to submit pull requests, issues,
  and/or to get in touch with us with suggestions!
</p>


<h2>Other contributions</h2>
<!-- <h2>Other acknowledgments</h2> -->

We thank:

<ul>
  <li>
    <a href="https://arxiv.org/help/api/index" target="_blank">arxiv.org</a> and
    <a href="https://crossref.org/" target="_blank">crossref.org</a> for use of
    their open access interoperability.
  </li>
  <li>
    Ryhor Kandratsenia, Thomas E. Albert, and Tatyana R. Albert for providing
    child care duties.
  </li>
</ul>


<script type="text/javascript">
  window.addEventListener('load', function() {
      var frag = window.location.hash;
      if (frag.length && frag.startsWith('#u-')) {
          document.getElementById(frag.slice(1)).classList.add('tile-person-highlight');
      }
  } );
</script>

`;

    return s;
}


export default { data, render, };
