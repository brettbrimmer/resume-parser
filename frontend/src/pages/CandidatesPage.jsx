import React from "react";
import { useParams } from "react-router-dom";
import AppCandidates from "../components/AppCandidates";

/**
 * CandidatesPage component.
 *
 * Extracts the job ID from the route parameters and renders the AppCandidates
 * component with the corresponding job ID as a prop.
 *
 * Returns:
 *   JSX.Element: The rendered candidate management interface for the specified job.
 */
export default function CandidatesPage() {
  const { jobId } = useParams();
  const parsedJobId = parseInt(jobId, 10);

  return <AppCandidates jobId={parsedJobId} />;
}
