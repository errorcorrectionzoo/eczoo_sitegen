const data = {
    title: 'Team',
    tags: ['sitePage'],
};

// Display a person
const render_person = (person) => {
    s = ''

    let avatar_url = '';
    let avatar_add_class = '';
    if (person.avatarurl != null && person.avatarurl !== '') {
        avatar_url = person.avatarurl;
    } else if (person.githubusername != null && person.githubusername !== '') {
        avatar_url = `https://github.com/${person.githubusername}.png`;
    } else {
        avatar_add_class = ' person-avatar-unknown';
        //avatar_url = `~/static/icons/avatar-unknown.svg`;
    }

    s += `
<div class="tile tile-person${avatar_add_class}" id="u-${person.user_id}"
     data-tile-image="${avatar_url}"
     ><div class="tile-content"><div class="tile-person-line tile-persion-name-line">`;
    s += `<span class="person-name">${person.name}</span>`;
    if (person.zoorole != null && person.zoorole !== '') {
        s += `<span class="person-zoorole"> (${person.zoorole})</span>`;
    }
    s += `</div>`;
    s += `<div class="tile-person-line tile-person-links-line">`;
    if (person.pageurl != null && person.pageurl !== '') {
        s += `<span class="person-linkdetail person-pageurl"
  ><a href="${person.pageurl}" target="_blank">web</a></span>`;
    }
    if (person.gscholaruser != null && person.gscholaruser !== '') {
        s += `<span class="person-linkdetail person-gscholaruser"
  ><a href="https://scholar.google.com/citations?user=${person.gscholaruser}"
      target="_blank">google scholar</a></span>`;
    }
    if (person.githubusername != null && person.githusername !== '') {
        s += `<span class="person-linkdetail person-githubusername"
  ><a href="https://github.com/${person.githubusername}"
      target="_blank">github</a></span>`;
    }
    s += `&nbsp;`;
    s += `</div></div></div>`;

    return s;
};


const zoo_teams_list = [ 'core', 'veterinarians', 'code_contributors' ];

const zoo_roles_list = ['zookeeper', 'architect'];


const render = (data) => {

    const { eczoodb } = data;

    let zoo_contributors_by_team = {
        core: [],
        veterinarians: [],
        code_contributors: [],
    };

    for (const [user_id,user] of Object.entries(eczoodb.objects.user)) {

        const zooteam = user.zooteam || 'code_contributors';

        let d = zoo_contributors_by_team[zooteam];

        d.push(user);
    }

    s = '';

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
      document.querySelectorAll('.tile[data-tile-image]').forEach( function(tile) {
          if (tile.dataset.tileImage) {
            tile.style.backgroundImage = "url('"+tile.dataset.tileImage+"')";
          }
      } );
      var frag = window.location.hash;
      if (frag.length && frag.startsWith('#u-')) {
          document.getElementById(frag.slice(1)).classList.add('tile-person-highlight');
      }
  } );
</script>

`;

    return s;
}


module.exports = { data, render, };
