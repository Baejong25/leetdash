class Solution {
    public int lengthOfLastWord(String s) {

		String[] rtn = s.trim().split(" ");

		return rtn[rtn.length -1].length();
    }
}
