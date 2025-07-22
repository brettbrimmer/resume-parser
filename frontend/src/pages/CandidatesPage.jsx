import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppCandidates from "../components/AppCandidates"; 
// extract your existing App.jsx UI into AppCandidates, but accept jobId prop

export default function CandidatesPage() {
  const { jobId }   = useParams();
  const parsedJobId = parseInt(jobId, 10);

  return (
    <AppCandidates jobId={parsedJobId} />
  );
}
