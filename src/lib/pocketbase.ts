import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

// Auto-refresh authentication
pb.authStore.onChange(() => {
  console.log('Auth state changed:', pb.authStore.isValid);
});

export default pb;