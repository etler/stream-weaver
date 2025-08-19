# Stream Weaver

This project showcases a new approach to creating streaming frameworks by utilizing a technique that enables entire streams to be enqueued onto other streams with minimal orchestration or memory overhead.

The idea is explored in [TECHNICAL.md](/TECHNICAL.md). It can be converted into a LaTeX paper if you have [pandoc](https://pandoc.org/) installed by running `npm install` and `npm run paper`. If you also have pdflatex installed, a PDF version can be generated with `npm run pdf`.

A proof of concept implementation of the streaming agent swarms outlined in the paper has been implemented in a separate repo: [/etler/swarm-weaver](https://github.com/etler/swarm-weaver).

This project also provides a proof of concept implementation of some of the streaming web rendering ideas outlined in the paper. It includes source code and tests for demonstrating how components can be represented as streams and composed an a parallel asyncronous fashion. It can be tried out by installing the dependencies with `npm install` and running tests with `npm test`. It can be imported locally for experimentation.

© [Tim Etler][author]

[author]: https://github.com/etler
