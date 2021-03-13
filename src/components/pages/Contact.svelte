<script>
    let pokemon

    fetch('https://pokeapi.co/api/v2/pokemon?limit=10&offset=0')
    .then(response => response.json())
    .then(data => {
        pokemon = data;
        console.log(pokemon);
    });
</script>
<p>Contact page!</p>

{#if pokemon}
    <a href={pokemon.next}>New </a>
    {#each pokemon.results as item, i}
		<p> {item.name} {i} </p>
	{/each}
{:else}
    <p>Cargando...</p>
{/if}
