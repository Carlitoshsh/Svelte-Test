<script>
    import {link} from 'svelte-spa-router';
    import active from 'svelte-spa-router/active';
</script>    

<div class="my-nav-container">
    <div class="my-nav">
        <a href="/" use:link use:active>Home</a>
        <a href="/pokemon" use:link use:active>Pokemon API</a>
        <a href="/about" use:link use:active>About</a>
    </div>
</div>

<style>
    .my-nav-container{
        max-width: 350px;
        margin: 0 auto;
    }

    .my-nav {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    a {
        text-decoration: none;
        color: var(--light-back);
    }

    a:hover{
        color: var(--primary);
    }

    :global(a.active) {
        border-bottom: 1px solid var(--primary);
        font-weight: bold;
    }

    @media only screen and (max-width: 320px) {
        .my-nav {
            flex-direction: column;
            align-items: center;
        }
    }
</style>
