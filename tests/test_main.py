"""Tests for the starter application."""

import unittest

from python_starter.main import greet


class GreetTests(unittest.TestCase):
    def test_default_greeting(self) -> None:
        self.assertEqual(greet(), "Hello, World!")

    def test_custom_greeting(self) -> None:
        self.assertEqual(greet("Python"), "Hello, Python!")


if __name__ == "__main__":
    unittest.main()
