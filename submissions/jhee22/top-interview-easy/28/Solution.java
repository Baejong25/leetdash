class Solution {
    public int strStr(String haystack, String needle) {
        StringBuilder sb = new StringBuilder(); 
        for (int i = 0; i < haystack.length(); i++){
            sb.append(haystack.charAt(i)); 
            if (sb.indexOf(needle) != -1 ){
                return haystack.indexOf(needle);
            }
        }
        return -1;
    }
}