// Simple test to check if research API is working
import axios from 'axios';

async function testAPI() {
  try {
    console.log('Testing research API...');
    
    const response = await axios.get('http://localhost:5000/api/research/test');
    console.log('Test endpoint response:', response.data);
    
    const searchResponse = await axios.get('http://localhost:5000/api/research/search?query=hydrogen&sources=pubmed');
    console.log('Search endpoint response:', searchResponse.data);
    
  } catch (error) {
    console.error('API test failed:', error.response?.data || error.message);
  }
}

testAPI();