import { memo } from "react";

export interface StudyImageProps {
  studyId: number;
  imageUrl?: string;
  imageAlt?: string;
  title?: string;
  authors?: string;
  journal?: string;
  year?: number;
}

const StudyImage = memo(function StudyImage({
  studyId,
  imageUrl,
  imageAlt,
  title = "Hydrogen Research Study",
  authors = "Hydrogen Researchers",
  journal = "Scientific Journal",
  year,
}: StudyImageProps) {
  // If image URL is provided and seems valid, return an actual image
  if (
    imageUrl &&
    imageUrl.trim() !== "" &&
    !imageUrl.includes("placehold.co")
  ) {
    return (
      <div className="w-full rounded-md shadow-md overflow-hidden bg-white">
        <img
          src={imageUrl}
          alt={imageAlt || `Study visualization: ${title}`}
          className="w-full object-cover h-auto max-h-96"
          loading="lazy"
          onError={(e) => {
            // On error, replace with a styled div
            const target = e.target as HTMLImageElement;
            const parent = target.parentNode as HTMLElement;

            if (parent) {
              // Create a fallback element
              const fallback = document.createElement("div");
              fallback.className =
                "w-full h-96 bg-sky-50 flex flex-col items-center justify-center p-6 text-center";

              // Add study ID
              const idEl = document.createElement("div");
              idEl.className = "text-teal-900 text-lg font-semibold mb-2";
              idEl.textContent = `Study #${studyId}`;
              fallback.appendChild(idEl);

              // Add title
              const titleEl = document.createElement("h3");
              titleEl.className =
                "text-teal-900 text-xl font-bold mb-4 max-w-lg";
              titleEl.textContent = title;
              fallback.appendChild(titleEl);

              // Add authors
              const authorsEl = document.createElement("p");
              authorsEl.className = "text-teal-800 mb-4";
              authorsEl.textContent = authors;
              fallback.appendChild(authorsEl);

              // Add journal info
              const journalEl = document.createElement("p");
              journalEl.className = "text-teal-700 text-sm mb-8";
              journalEl.textContent = `${journal} (${year || new Date().getFullYear()})`;
              fallback.appendChild(journalEl);

              // Replace the img with the fallback
              parent.replaceChild(fallback, target);
            }
          }}
        />
      </div>
    );
  }

  // Otherwise, render a styled div with study information
  return (
    <div className="w-full h-96 bg-gradient-to-br from-sky-50 to-teal-50 rounded-md shadow-md flex flex-col items-center justify-center p-6 text-center">
      <div className="text-teal-900 text-lg font-semibold mb-2">
        Study #{studyId}
      </div>

      <h3 className="text-teal-900 text-xl font-bold mb-4 max-w-lg">{title}</h3>

      <p className="text-teal-800 mb-4">{authors}</p>

      <p className="text-teal-700 text-sm mb-8">
        {journal} ({year || new Date().getFullYear()})
      </p>

      {/* Simple hydrogen molecule visualization with CSS */}
      <div className="flex items-center justify-center mt-4 gap-8">
        <div className="w-16 h-16 rounded-full bg-teal-500 opacity-70 shadow-lg"></div>
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-teal-800 opacity-70 shadow-lg"></div>
          <div className="absolute top-1/2 left-[-16px] transform -translate-y-1/2 h-1.5 w-[32px] bg-teal-900"></div>
        </div>
      </div>
    </div>
  );
});

export default StudyImage;
