import { fixMissingImages, getImageStatus } from './direct-image-fix';

// Run the image fix immediately when this file is executed
async function main() {
  try {
    console.log('Checking current image status...');
    const beforeStatus = await getImageStatus();
    console.log('Current status:', beforeStatus);
    
    console.log('Fixing missing images...');
    const result = await fixMissingImages();
    
    if (result.success) {
      console.log('Success!', result.message);
      console.log(`Fixed ${result.fixed} studies with missing images`);
      console.log('New status:', result.after);
    } else {
      console.error('Error:', result.message);
    }
  } catch (error) {
    console.error('Unexpected error running image fix:', error);
  }
}

// Run the main function
main().then(() => console.log('Image fix process complete'));