class Solution {
    public int strStr(String haystack, String needle) {
		for (int i =0; i <= haystack.length() - needle.length(); i++) {
			if (haystack.subSequence(i, i + needle.length()).equals(needle)) {
				return i;
			}
		}

		return -1;
    }
}
