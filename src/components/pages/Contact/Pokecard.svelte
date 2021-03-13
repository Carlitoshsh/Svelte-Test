<script>
    export let pokemon;
    let default_image = "official-artwork";

    function toggleShow(){
        default_image = default_image == "dream_world" ?  "official-artwork" :"dream_world" ;
    }
</script>

{#if pokemon}
    <div class="pokemon"
            on:mouseenter={toggleShow}
	        on:mouseleave={toggleShow}>
        <img
            src={pokemon.sprites.other[default_image]?.front_default}
            alt="image_{pokemon.name}"
        />
        <p>{pokemon.name}</p>
    </div>
{/if}

<style>
    .pokemon {
        justify-self: center;
    }

    p {
        text-transform: capitalize;
        color: var(--light-back);
        text-align: center;
        font-weight: bold;
        background: var(--text);
        border-radius: 6px;
    }
    
    img {
        border-radius: 5px;
        max-width: 150px;
        height: 150px;
        background-color: var(--primary);
    }

    img:hover{
        cursor: pointer;
        background: var(--text);
    }
</style>
