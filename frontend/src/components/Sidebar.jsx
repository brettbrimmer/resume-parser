import { useState } from "react";
import axios from "axios";
import { Box, Textarea, Button } from "@chakra-ui/react"; // or plain HTML elements

function Sidebar({ onNewScores }) {
  const [reqText, setReqText] = useState("");

  const handleClick = async () => {
    const lines = reqText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const { data } = await axios.post("/api/requirements", {
      requirements: lines,
    });

    // Pass mapping + scores up to parent
    onNewScores(data.mapping, data.candidates);
  };

  return (
    <Box mb={6}>
      <Textarea
        placeholder="One requirement per line…"
        value={reqText}
        onChange={(e) => setReqText(e.target.value)}
        rows={6}
      />
      <Button mt={2} colorScheme="teal" onClick={handleClick}>
        Apply Requirements
      </Button>
    </Box>
  );
}
